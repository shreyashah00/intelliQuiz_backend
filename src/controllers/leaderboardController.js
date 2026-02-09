const { default: prisma } = require('../lib/prismaClient');

/**
 * Get leaderboard for a specific quiz (teacher only)
 */
exports.getQuizLeaderboard = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view leaderboards'
      });
    }

    // Validate quizId
    if (!quizId || isNaN(parseInt(quizId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID'
      });
    }

    const parsedQuizId = parseInt(quizId);

    // Verify quiz ownership
    const quiz = await prisma.quiz.findFirst({
      where: { QuizID: parsedQuizId, CreatedBy: teacherId }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or access denied'
      });
    }

    // Get all quiz responses with user details
    const responses = await prisma.quizResponse.findMany({
      where: {
        QuizID: parsedQuizId,
        Status: 'completed'
      },
      include: {
        User: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true,
            Email: true,
            ProfilePicture: true
          }
        }
      },
      orderBy: [
        { Score: 'desc' },
        { CompletedAt: 'asc' }
      ]
    });

    // Calculate statistics
    const totalSubmissions = responses.length;
    const averageScore = totalSubmissions > 0
      ? responses.reduce((sum, r) => sum + r.Score, 0) / totalSubmissions
      : 0;

    const highestScore = totalSubmissions > 0 ? responses[0].Score : 0;
    const lowestScore = totalSubmissions > 0 ? responses[responses.length - 1].Score : 0;

    // Format leaderboard data
    const leaderboard = responses.map((response, index) => ({
      rank: index + 1,
      userId: response.User.UserID,
      username: response.User.Username,
      fullName: `${response.User.FirstName || ''} ${response.User.LastName || ''}`.trim() || response.User.Username,
      email: response.User.Email,
      profilePicture: response.User.ProfilePicture,
      score: response.Score,
      totalScore: response.TotalScore,
      percentage: response.Percentage,
      timeSpent: response.TimeSpent,
      completedAt: response.CompletedAt,
      aiInsightsGenerated: response.AIInsightsGenerated
    }));

    res.json({
      success: true,
      data: {
        quiz: {
          quizId: quiz.QuizID,
          title: quiz.Title,
          subject: quiz.Subject,
          difficulty: quiz.Difficulty,
          totalQuestions: quiz.TotalQuestions,
          timeLimit: quiz.TimeLimit
        },
        leaderboard,
        statistics: {
          totalSubmissions,
          averageScore: Math.round(averageScore * 100) / 100,
          highestScore,
          lowestScore,
          completionRate: totalSubmissions > 0 ? 100 : 0 // Could be enhanced to track started vs completed
        }
      }
    });

  } catch (error) {
    console.error('Get quiz leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leaderboard'
    });
  }
};

/**
 * Get leaderboard for all quizzes in a group (teacher only)
 */
exports.getGroupLeaderboard = async (req, res) => {
  try {
    const { groupId } = req.params;
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view leaderboards'
      });
    }

    // Validate groupId
    if (!groupId || isNaN(parseInt(groupId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const parsedGroupId = parseInt(groupId);

    // Verify group ownership
    const group = await prisma.group.findFirst({
      where: { GroupID: parsedGroupId, CreatedBy: teacherId }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied'
      });
    }

    // Get all published quizzes for this group
    const quizGroups = await prisma.quizGroup.findMany({
      where: {
        GroupID: parsedGroupId,
        Status: 'published'
      },
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            Subject: true,
            Difficulty: true,
            TotalQuestions: true,
            TimeLimit: true
          }
        }
      }
    });

    if (quizGroups.length === 0) {
      return res.json({
        success: true,
        data: {
          group: {
            groupId: group.GroupID,
            name: group.Name
          },
          leaderboard: [],
          quizStats: [],
          statistics: {
            totalQuizzes: 0,
            totalSubmissions: 0,
            averageScore: 0
          }
        }
      });
    }

    const quizIds = quizGroups.map(qg => qg.QuizID);

    // Get all responses for these quizzes
    const responses = await prisma.quizResponse.findMany({
      where: {
        QuizID: { in: quizIds },
        Status: 'completed'
      },
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            Subject: true,
            Difficulty: true,
            TotalQuestions: true
          }
        },
        User: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true,
            Email: true,
            ProfilePicture: true
          }
        }
      }
    });

    // Calculate per-user statistics across all quizzes
    const userStats = new Map();

    responses.forEach(response => {
      const userId = response.User.UserID;

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          user: response.User,
          totalScore: 0,
          totalPossible: 0,
          quizzesCompleted: 0,
          averagePercentage: 0,
          quizDetails: []
        });
      }

      const userStat = userStats.get(userId);
      userStat.totalScore += response.Score;
      userStat.totalPossible += response.TotalScore;
      userStat.quizzesCompleted += 1;
      userStat.quizDetails.push({
        quizId: response.Quiz.QuizID,
        quizTitle: response.Quiz.Title,
        score: response.Score,
        totalScore: response.TotalScore,
        percentage: response.Percentage,
        completedAt: response.CompletedAt
      });
    });

    // Calculate averages and create leaderboard
    const leaderboard = Array.from(userStats.entries()).map(([userId, stats]) => {
      const averagePercentage = stats.totalPossible > 0
        ? (stats.totalScore / stats.totalPossible) * 100
        : 0;

      return {
        userId,
        username: stats.user.Username,
        fullName: `${stats.user.FirstName || ''} ${stats.user.LastName || ''}`.trim() || stats.user.Username,
        email: stats.user.Email,
        profilePicture: stats.user.ProfilePicture,
        totalScore: stats.totalScore,
        totalPossible: stats.totalPossible,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        quizzesCompleted: stats.quizzesCompleted,
        quizDetails: stats.quizDetails
      };
    });

    // Sort by average percentage (descending)
    leaderboard.sort((a, b) => b.averagePercentage - a.averagePercentage);

    // Add ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Calculate quiz statistics
    const quizStats = quizGroups.map(qg => {
      const quizResponses = responses.filter(r => r.QuizID === qg.QuizID);
      const avgScore = quizResponses.length > 0
        ? quizResponses.reduce((sum, r) => sum + r.Score, 0) / quizResponses.length
        : 0;

      return {
        quizId: qg.Quiz.QuizID,
        title: qg.Quiz.Title,
        subject: qg.Quiz.Subject,
        difficulty: qg.Quiz.Difficulty,
        totalQuestions: qg.Quiz.TotalQuestions,
        submissions: quizResponses.length,
        averageScore: Math.round(avgScore * 100) / 100
      };
    });

    // Overall statistics
    const totalSubmissions = responses.length;
    const overallAverage = leaderboard.length > 0
      ? leaderboard.reduce((sum, entry) => sum + entry.averagePercentage, 0) / leaderboard.length
      : 0;

    res.json({
      success: true,
      data: {
        group: {
          groupId: group.GroupID,
          name: group.Name,
          description: group.Description
        },
        leaderboard,
        quizStats,
        statistics: {
          totalQuizzes: quizGroups.length,
          totalSubmissions,
          averageScore: Math.round(overallAverage * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Get group leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching group leaderboard'
    });
  }
};

/**
 * Get recent submissions for teacher dashboard (real-time updates)
 */
exports.getRecentSubmissions = async (req, res) => {
  try {
    const teacherId = req.user.UserID;
    const { limit = 10 } = req.query;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view submissions'
      });
    }

    // Get teacher's quizzes
    const teacherQuizzes = await prisma.quiz.findMany({
      where: { CreatedBy: teacherId },
      select: { QuizID: true }
    });

    const quizIds = teacherQuizzes.map(q => q.QuizID);

    if (quizIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get recent submissions
    const recentSubmissions = await prisma.quizResponse.findMany({
      where: {
        QuizID: { in: quizIds },
        Status: 'completed'
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
      orderBy: { CompletedAt: 'desc' },
      take: parseInt(limit)
    });

    const formattedSubmissions = recentSubmissions.map(submission => ({
      submissionId: submission.ResponseID,
      quizId: submission.Quiz.QuizID,
      quizTitle: submission.Quiz.Title,
      quizSubject: submission.Quiz.Subject,
      userId: submission.User.UserID,
      username: submission.User.Username,
      fullName: `${submission.User.FirstName || ''} ${submission.User.LastName || ''}`.trim() || submission.User.Username,
      email: submission.User.Email,
      score: submission.Score,
      totalScore: submission.TotalScore,
      percentage: submission.Percentage,
      timeSpent: submission.TimeSpent,
      completedAt: submission.CompletedAt,
      aiInsightsGenerated: submission.AIInsightsGenerated
    }));

    res.json({
      success: true,
      data: formattedSubmissions
    });

  } catch (error) {
    console.error('Get recent submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recent submissions'
    });
  }
};