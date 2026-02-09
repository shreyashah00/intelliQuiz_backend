const socketIo = require('socket.io');
const { default: prisma } = require('../lib/prismaClient');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
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
      socket.on('authenticate', (userId) => {
        this.connectedUsers.set(userId, socket.id);
        socket.userId = userId;
        console.log(`User ${userId} authenticated with socket ${socket.id}`);
      });

      // Handle quiz submission for real-time leaderboard updates
      socket.on('quizSubmitted', async (data) => {
        try {
          const { quizId, userId, score, totalScore } = data;

          // Emit to teacher dashboard for this quiz
          this.io.to(`quiz_${quizId}`).emit('leaderboardUpdate', {
            type: 'newSubmission',
            data: {
              userId,
              score,
              totalScore,
              submittedAt: new Date()
            }
          });

          // Also emit to all teachers (if they have teacher dashboard open)
          this.io.to('teachers').emit('submissionNotification', {
            quizId,
            userId,
            score,
            totalScore
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

      // Join teacher room
      socket.on('joinTeacherRoom', () => {
        socket.join('teachers');
        console.log(`User ${socket.userId} joined teacher room`);
      });

      socket.on('disconnect', () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
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

  // Send notification to all teachers
  notifyTeachers(event, data) {
    this.io.to('teachers').emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

const socketService = new SocketService();
module.exports = socketService;