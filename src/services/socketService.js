const socketIo = require('socket.io');
const { default: prisma } = require('../lib/prismaClient');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.socketSubscriptions = new Map(); // socketId -> Map(channelKey, subscription)
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.APP_URL || 'http://localhost:3500',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      // Authenticate user
      socket.on('authenticate', async (authPayload, ack) => {
        try {
          const payload = typeof authPayload === 'object' && authPayload !== null
            ? authPayload
            : { userId: authPayload };

          const userId = parseInt(payload.userId);
          if (!userId || Number.isNaN(userId)) {
            const errorResponse = { success: false, message: 'Invalid userId for socket authentication' };
            socket.emit('socketAuthenticationError', errorResponse);
            if (typeof ack === 'function') ack(errorResponse);
            return;
          }

          let userRole = payload.role;
          if (!userRole) {
            const user = await prisma.user.findUnique({
              where: { UserID: userId },
              select: { Role: true }
            });
            userRole = user?.Role || null;
          }

          this.connectedUsers.set(userId, socket.id);
          socket.userId = userId;
          socket.userRole = userRole;

          const successResponse = {
            success: true,
            message: 'Socket authentication successful',
            data: {
              userId,
              role: userRole,
              socketId: socket.id
            }
          };

          socket.emit('socketAuthenticated', successResponse);
          if (typeof ack === 'function') ack(successResponse);

          console.log(`User ${userId} authenticated with socket ${socket.id} (${userRole || 'unknown role'})`);
        } catch (error) {
          console.error('Socket authenticate error:', error);
          const errorResponse = { success: false, message: 'Socket authentication failed' };
          socket.emit('socketAuthenticationError', errorResponse);
          if (typeof ack === 'function') ack(errorResponse);
        }
      });

      socket.on('subscribeLiveActivities', async (subscriptionPayload, ack) => {
        const response = await this.handleSubscription(socket, subscriptionPayload);
        if (typeof ack === 'function') {
          ack(response);
        }
      });

      socket.on('unsubscribeLiveActivities', (subscriptionPayload, ack) => {
        const response = this.handleUnsubscribe(socket, subscriptionPayload);
        if (typeof ack === 'function') {
          ack(response);
        }
      });

      // Handle quiz submission for real-time leaderboard updates
      socket.on('quizSubmitted', async (data) => {
        try {
          await this.emitSubmissionActivities({
            quizId: parseInt(data.quizId),
            userId: parseInt(data.userId),
            score: data.score,
            totalScore: data.totalScore,
            percentage: data.percentage,
            submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date()
          });

        } catch (error) {
          console.error('Error handling quiz submission socket event:', error);
        }
      });

      // Join quiz room for real-time updates
      socket.on('joinQuizRoom', (quizId) => {
        socket.join(`quiz_${quizId}`);
        console.log(`User ${socket.userId} joined quiz room ${quizId}`);
      });

      socket.on('joinGroupRoom', (groupId) => {
        socket.join(`group_${groupId}`);
        console.log(`User ${socket.userId} joined group room ${groupId}`);
      });

      // Join teacher room
      socket.on('joinTeacherRoom', () => {
        socket.join('teachers');
        console.log(`User ${socket.userId} joined teacher room`);
      });

      socket.on('disconnect', () => {
        this.clearSocketSubscriptions(socket.id);

        if (socket.userId) {
          const activeSocketId = this.connectedUsers.get(socket.userId);
          if (activeSocketId === socket.id) {
            this.connectedUsers.delete(socket.userId);
          }

          console.log(`User ${socket.userId} disconnected`);
        }
      });
    });

    console.log('Socket.IO initialized');
  }

  // Send notification to specific user
  notifyUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Send notification to all users in a quiz room
  notifyQuizRoom(quizId, event, data) {
    this.io.to(`quiz_${quizId}`).emit(event, data);
  }

  // Send notification to all users in a group room
  notifyGroupRoom(groupId, event, data) {
    this.io.to(`group_${groupId}`).emit(event, data);
  }

  // Send notification to all teachers
  notifyTeachers(event, data) {
    this.io.to('teachers').emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  resolveIntervalMs(intervalSeconds) {
    const requestedMs = Number(intervalSeconds) * 1000;
    if (Number.isNaN(requestedMs) || requestedMs <= 0) {
      return 12000;
    }

    return Math.min(15000, Math.max(10000, requestedMs));
  }

  clearSocketSubscriptions(socketId) {
    const subscriptions = this.socketSubscriptions.get(socketId);
    if (!subscriptions) {
      return;
    }

    subscriptions.forEach((subscription) => {
      clearInterval(subscription.intervalId);
    });

    this.socketSubscriptions.delete(socketId);
  }

  clearSingleSubscription(socketId, channelKey) {
    const subscriptions = this.socketSubscriptions.get(socketId);
    if (!subscriptions) {
      return;
    }

    const existing = subscriptions.get(channelKey);
    if (existing) {
      clearInterval(existing.intervalId);
      subscriptions.delete(channelKey);
    }

    if (subscriptions.size === 0) {
      this.socketSubscriptions.delete(socketId);
    }
  }

  async ensureTeacher(socket) {
    if (!socket.userId) {
      return { ok: false, message: 'Socket is not authenticated' };
    }

    let role = socket.userRole;
    if (!role) {
      const user = await prisma.user.findUnique({
        where: { UserID: socket.userId },
        select: { Role: true }
      });

      role = user?.Role;
      socket.userRole = role;
    }

    if (role !== 'teacher') {
      return { ok: false, message: 'Only teacher users can subscribe to live activities' };
    }

    return { ok: true };
  }

  async handleSubscription(socket, payload = {}) {
    try {
      const teacherCheck = await this.ensureTeacher(socket);
      if (!teacherCheck.ok) {
        return { success: false, message: teacherCheck.message };
      }

      const connectionType = payload.connectionType;
      const validConnectionTypes = ['teacher_dashboard', 'quiz_leaderboard', 'group_leaderboard'];

      if (!validConnectionTypes.includes(connectionType)) {
        return {
          success: false,
          message: `Invalid connectionType. Allowed values: ${validConnectionTypes.join(', ')}`
        };
      }

      const intervalMs = this.resolveIntervalMs(payload.intervalSeconds);
      const intervalSeconds = intervalMs / 1000;

      let resourceId = null;
      let roomName = `teacher_dashboard_${socket.userId}`;

      if (connectionType === 'quiz_leaderboard') {
        resourceId = parseInt(payload.quizId);
        if (!resourceId || Number.isNaN(resourceId)) {
          return { success: false, message: 'quizId is required for quiz_leaderboard subscriptions' };
        }

        const quiz = await prisma.quiz.findFirst({
          where: { QuizID: resourceId, CreatedBy: socket.userId },
          select: { QuizID: true }
        });

        if (!quiz) {
          return { success: false, message: 'Quiz not found or access denied' };
        }

        roomName = `quiz_${resourceId}`;
      }

      if (connectionType === 'group_leaderboard') {
        resourceId = parseInt(payload.groupId);
        if (!resourceId || Number.isNaN(resourceId)) {
          return { success: false, message: 'groupId is required for group_leaderboard subscriptions' };
        }

        const group = await prisma.group.findFirst({
          where: { GroupID: resourceId, CreatedBy: socket.userId },
          select: { GroupID: true }
        });

        if (!group) {
          return { success: false, message: 'Group not found or access denied' };
        }

        roomName = `group_${resourceId}`;
      }

      const channelKey = `${connectionType}:${resourceId || socket.userId}`;
      this.clearSingleSubscription(socket.id, channelKey);

      if (!this.socketSubscriptions.has(socket.id)) {
        this.socketSubscriptions.set(socket.id, new Map());
      }

      socket.join(roomName);

      const initialCursor = payload.cursorAt ? new Date(payload.cursorAt) : new Date(Date.now() - intervalMs);
      const validCursor = Number.isNaN(initialCursor.getTime()) ? new Date(Date.now() - intervalMs) : initialCursor;

      const subscription = {
        channelKey,
        connectionType,
        resourceId,
        intervalMs,
        intervalSeconds,
        cursorAt: validCursor,
        roomName,
        isRunning: false,
        isInitialDispatch: true,
        intervalId: null
      };

      subscription.intervalId = setInterval(async () => {
        await this.pushLiveUpdate(socket, subscription);
      }, intervalMs);

      this.socketSubscriptions.get(socket.id).set(channelKey, subscription);

      await this.pushLiveUpdate(socket, subscription);

      const response = {
        success: true,
        message: 'Live activity subscription created',
        data: {
          connectionType,
          roomName,
          intervalSeconds,
          cursorAt: subscription.cursorAt.toISOString()
        }
      };

      socket.emit('liveActivitySubscribed', response);
      return response;
    } catch (error) {
      console.error('Subscription error:', error);
      return { success: false, message: 'Failed to subscribe live activities' };
    }
  }

  handleUnsubscribe(socket, payload = {}) {
    const connectionType = payload.connectionType;
    const resourceId = payload.quizId || payload.groupId || socket.userId;
    const channelKey = `${connectionType}:${resourceId}`;

    this.clearSingleSubscription(socket.id, channelKey);

    return {
      success: true,
      message: 'Live activity subscription removed',
      data: {
        connectionType,
        resourceId
      }
    };
  }

  async pushLiveUpdate(socket, subscription) {
    if (!this.io || subscription.isRunning || !socket.connected) {
      return;
    }

    subscription.isRunning = true;

    try {
      let updates = [];
      let nextCursor = subscription.cursorAt;

      if (subscription.connectionType === 'teacher_dashboard') {
        updates = await this.fetchTeacherDashboardUpdates(socket.userId, subscription.cursorAt);
      }

      if (subscription.connectionType === 'quiz_leaderboard') {
        updates = await this.fetchQuizLeaderboardUpdates(socket.userId, subscription.resourceId, subscription.cursorAt);
      }

      if (subscription.connectionType === 'group_leaderboard') {
        updates = await this.fetchGroupLeaderboardUpdates(socket.userId, subscription.resourceId, subscription.cursorAt);
      }

      if (updates.length > 0) {
        const latestUpdateTime = updates[updates.length - 1].completedAt;
        if (latestUpdateTime) {
          const parsedLatest = new Date(latestUpdateTime);
          if (!Number.isNaN(parsedLatest.getTime())) {
            nextCursor = parsedLatest;
          }
        }
      }

      const eventNameByType = {
        teacher_dashboard: 'teacherDashboardActivity',
        quiz_leaderboard: 'quizLeaderboardActivity',
        group_leaderboard: 'groupLeaderboardActivity'
      };

      const hasUpdates = updates.length > 0;
      const isQuizWithoutUpdates = subscription.connectionType === 'quiz_leaderboard' && !hasUpdates;

      const payload = {
        success: true,
        connectionType: subscription.connectionType,
        roomName: subscription.roomName,
        intervalSeconds: subscription.intervalSeconds,
        serverTime: new Date().toISOString(),
        hasUpdates,
        status: hasUpdates ? 'updates' : (isQuizWithoutUpdates ? 'no_response_for_quiz' : 'no_updates'),
        cursorAt: nextCursor.toISOString(),
        data: hasUpdates
          ? {
              submissions: updates
            }
          : null
      };

      socket.emit(eventNameByType[subscription.connectionType], payload);

      if (subscription.connectionType === 'quiz_leaderboard' && !hasUpdates) {
        socket.emit('quizLeaderboardNoResponse', payload);
      }

      subscription.cursorAt = nextCursor;
      subscription.isInitialDispatch = false;
    } catch (error) {
      console.error('Live update push error:', error);
      socket.emit('liveActivityError', {
        success: false,
        message: 'Failed to push live activity updates',
        connectionType: subscription.connectionType,
        serverTime: new Date().toISOString()
      });
    } finally {
      subscription.isRunning = false;
    }
  }

  async fetchTeacherDashboardUpdates(teacherId, cursorAt) {
    const teacherQuizzes = await prisma.quiz.findMany({
      where: { CreatedBy: teacherId },
      select: { QuizID: true }
    });

    const quizIds = teacherQuizzes.map(q => q.QuizID);
    if (quizIds.length === 0) {
      return [];
    }

    const responses = await prisma.quizResponse.findMany({
      where: {
        QuizID: { in: quizIds },
        Status: 'completed',
        CompletedAt: { gt: cursorAt }
      },
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            Subject: true
          }
        },
        User: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true,
            Email: true
          }
        }
      },
      orderBy: { CompletedAt: 'asc' }
    });

    return responses.map(response => this.formatSubmissionRecord(response));
  }

  async fetchQuizLeaderboardUpdates(teacherId, quizId, cursorAt) {
    const quiz = await prisma.quiz.findFirst({
      where: { QuizID: quizId, CreatedBy: teacherId },
      select: { QuizID: true }
    });

    if (!quiz) {
      return [];
    }

    const responses = await prisma.quizResponse.findMany({
      where: {
        QuizID: quizId,
        Status: 'completed',
        CompletedAt: { gt: cursorAt }
      },
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            Subject: true
          }
        },
        User: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true,
            Email: true
          }
        }
      },
      orderBy: { CompletedAt: 'asc' }
    });

    return responses.map(response => this.formatSubmissionRecord(response));
  }

  async fetchGroupLeaderboardUpdates(teacherId, groupId, cursorAt) {
    const group = await prisma.group.findFirst({
      where: { GroupID: groupId, CreatedBy: teacherId },
      select: { GroupID: true }
    });

    if (!group) {
      return [];
    }

    const quizGroups = await prisma.quizGroup.findMany({
      where: {
        GroupID: groupId,
        Status: 'published'
      },
      select: { QuizID: true }
    });

    const quizIds = quizGroups.map(qg => qg.QuizID);
    if (quizIds.length === 0) {
      return [];
    }

    const responses = await prisma.quizResponse.findMany({
      where: {
        QuizID: { in: quizIds },
        Status: 'completed',
        CompletedAt: { gt: cursorAt }
      },
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            Subject: true
          }
        },
        User: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true,
            Email: true
          }
        }
      },
      orderBy: { CompletedAt: 'asc' }
    });

    return responses.map(response => this.formatSubmissionRecord(response));
  }

  formatSubmissionRecord(response) {
    const timeSpentSeconds = typeof response.TimeSpent === 'number' ? response.TimeSpent : null;

    return {
      responseId: response.ResponseID,
      quizId: response.Quiz?.QuizID || response.QuizID,
      quizTitle: response.Quiz?.Title || null,
      quizSubject: response.Quiz?.Subject || null,
      userId: response.User?.UserID || response.UserID,
      username: response.User?.Username || null,
      fullName: response.User
        ? `${response.User.FirstName || ''} ${response.User.LastName || ''}`.trim() || response.User.Username
        : null,
      email: response.User?.Email || null,
      score: response.Score,
      totalScore: response.TotalScore,
      percentage: response.Percentage,
      timeSpent: timeSpentSeconds,
      timeSpentSeconds,
      timeSpentFormatted: this.formatDuration(timeSpentSeconds),
      completedAt: response.CompletedAt,
      aiInsightsGenerated: response.AIInsightsGenerated
    };
  }

  async emitSubmissionActivities(submissionData) {
    if (!this.io || !submissionData.quizId) {
      return;
    }

    const submittedAt = submissionData.submittedAt || new Date();

    const teacherQuiz = await prisma.quiz.findUnique({
      where: { QuizID: parseInt(submissionData.quizId) },
      select: {
        CreatedBy: true,
        Title: true,
        Subject: true
      }
    });

    const payloadSubmission = {
      responseId: submissionData.responseId || null,
      quizId: parseInt(submissionData.quizId),
      quizTitle: teacherQuiz?.Title || null,
      quizSubject: teacherQuiz?.Subject || null,
      userId: submissionData.userId,
      username: submissionData.username || null,
      fullName: submissionData.fullName || submissionData.username || null,
      score: submissionData.score,
      totalScore: submissionData.totalScore,
      percentage: submissionData.percentage,
      timeSpent: typeof submissionData.timeSpent === 'number' ? submissionData.timeSpent : null,
      timeSpentSeconds: typeof submissionData.timeSpent === 'number' ? submissionData.timeSpent : null,
      timeSpentFormatted: this.formatDuration(typeof submissionData.timeSpent === 'number' ? submissionData.timeSpent : null),
      submittedAt
    };

    // Legacy events retained for backward compatibility.
    this.io.to(`quiz_${submissionData.quizId}`).emit('leaderboardUpdate', {
      type: 'newSubmission',
      data: {
        userId: submissionData.userId,
        score: submissionData.score,
        totalScore: submissionData.totalScore,
        percentage: submissionData.percentage,
        timeSpent: typeof submissionData.timeSpent === 'number' ? submissionData.timeSpent : null,
        submittedAt
      }
    });

    this.io.to('teachers').emit('submissionNotification', {
      quizId: parseInt(submissionData.quizId),
      userId: submissionData.userId,
      score: submissionData.score,
      totalScore: submissionData.totalScore,
      percentage: submissionData.percentage,
      timeSpent: typeof submissionData.timeSpent === 'number' ? submissionData.timeSpent : null,
      submittedAt
    });

    // New strict channel payloads.
    this.io.to(`quiz_${submissionData.quizId}`).emit('quizLeaderboardActivity', {
      success: true,
      connectionType: 'quiz_leaderboard',
      roomName: `quiz_${submissionData.quizId}`,
      serverTime: new Date().toISOString(),
      hasUpdates: true,
      status: 'updates',
      data: {
        submissions: [payloadSubmission]
      }
    });

    if (teacherQuiz?.CreatedBy) {
      this.io.to(`teacher_dashboard_${teacherQuiz.CreatedBy}`).emit('teacherDashboardActivity', {
        success: true,
        connectionType: 'teacher_dashboard',
        roomName: `teacher_dashboard_${teacherQuiz.CreatedBy}`,
        serverTime: new Date().toISOString(),
        hasUpdates: true,
        status: 'updates',
        data: {
          submissions: [payloadSubmission]
        }
      });
    }

    const quizGroups = await prisma.quizGroup.findMany({
      where: {
        QuizID: parseInt(submissionData.quizId),
        Status: 'published'
      },
      select: { GroupID: true }
    });

    quizGroups.forEach((quizGroup) => {
      this.io.to(`group_${quizGroup.GroupID}`).emit('groupLeaderboardActivity', {
        success: true,
        connectionType: 'group_leaderboard',
        roomName: `group_${quizGroup.GroupID}`,
        serverTime: new Date().toISOString(),
        hasUpdates: true,
        status: 'updates',
        data: {
          submissions: [
            {
              ...payloadSubmission,
              groupId: quizGroup.GroupID
            }
          ]
        }
      });
    });
  }

  formatDuration(totalSeconds) {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) {
      return null;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}

const socketService = new SocketService();
module.exports = socketService;