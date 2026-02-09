const { default: prisma } = require('../lib/prismaClient');
const { generateAIInsights } = require('../services/insightsService');
const socketService = require('../services/socketService');

/**
 * Submit quiz response (student only)
 * Saves all answers and calculates score
 */
exports.submitQuizResponse = async (req, res) => {
  try {
    const { quizId, answers, timeSpent } = req.body;
    const userId = req.user.UserID;
    const startTime = new Date();

    // Validate input
    if (!quizId || !answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID and answers are required'
      });
    }

    // Fetch quiz with questions and options
    const quiz = await prisma.quiz.findUnique({
      where: { QuizID: parseInt(quizId) },
      include: {
        Questions: {
          include: {
            Options: true
          },
          orderBy: {
            OrderIndex: 'asc'
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (!quiz.IsPublished) {
      return res.status(403).json({
        success: false,
        message: 'Quiz is not published'
      });
    }

    // Check if user already submitted this quiz (optional: allow multiple attempts)
    const existingResponse = await prisma.quizResponse.findFirst({
      where: {
        QuizID: parseInt(quizId),
        UserID: userId,
        Status: 'completed'
      }
    });

    // Calculate score
    let totalScore = 0;
    let earnedScore = 0;
    const answersToSave = [];

    for (const question of quiz.Questions) {
      totalScore += question.Points;

      const userAnswer = answers.find(a => a.questionId === question.QuestionID);
      
      if (userAnswer) {
        let isCorrect = false;
        let pointsEarned = 0;

        if (question.QuestionType === 'multiple_choice' || question.QuestionType === 'true_false') {
          // Find the correct option
          const correctOption = question.Options.find(opt => opt.IsCorrect);
          const selectedOption = question.Options.find(opt => opt.OptionID === userAnswer.selectedOptionId);

          if (correctOption && selectedOption && selectedOption.IsCorrect) {
            isCorrect = true;
            pointsEarned = question.Points;
            earnedScore += pointsEarned;
          }

          answersToSave.push({
            QuestionID: question.QuestionID,
            SelectedOptionID: userAnswer.selectedOptionId,
            IsCorrect: isCorrect,
            PointsEarned: pointsEarned,
            TimeTaken: userAnswer.timeTaken || null
          });
        } else if (question.QuestionType === 'short_answer') {
          // For short answer, we'll need manual grading or AI-based evaluation
          // For now, we'll save it as not graded (0 points)
          answersToSave.push({
            QuestionID: question.QuestionID,
            AnswerText: userAnswer.answerText,
            IsCorrect: false, // Will be updated after manual grading
            PointsEarned: 0,
            TimeTaken: userAnswer.timeTaken || null
          });
        }
      }
    }

    const percentage = totalScore > 0 ? (earnedScore / totalScore) * 100 : 0;

    // Create quiz response
    const quizResponse = await prisma.quizResponse.create({
      data: {
        QuizID: parseInt(quizId),
        UserID: userId,
        Score: earnedScore,
        TotalScore: totalScore,
        Percentage: percentage,
        TimeSpent: timeSpent || null,
        Status: 'completed',
        StartedAt: startTime,
        CompletedAt: new Date(),
        Answers: {
          create: answersToSave
        }
      },
      include: {
        Answers: {
          include: {
            Question: {
              include: {
                Options: true
              }
            },
            SelectedOption: true
          }
        },
        Quiz: {
          select: {
            Title: true,
            Description: true,
            Difficulty: true,
            Subject: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      data: {
        responseId: quizResponse.ResponseID,
        score: earnedScore,
        totalScore: totalScore,
        percentage: percentage.toFixed(2),
        timeSpent: timeSpent,
        status: 'completed'
      }
    });

    // Emit real-time notification to teacher dashboard
    try {
      socketService.notifyTeachers('submissionNotification', {
        quizId: parseInt(quizId),
        userId,
        score: earnedScore,
        totalScore,
        percentage: Math.round(percentage * 100) / 100,
        submittedAt: new Date()
      });

      // Also emit to quiz-specific room for detailed leaderboard updates
      socketService.notifyQuizRoom(quizId, 'leaderboardUpdate', {
        type: 'newSubmission',
        data: {
          userId,
          username: req.user.Username,
          fullName: `${req.user.FirstName || ''} ${req.user.LastName || ''}`.trim() || req.user.Username,
          score: earnedScore,
          totalScore,
          percentage: Math.round(percentage * 100) / 100,
          submittedAt: new Date()
        }
      });
    } catch (socketError) {
      console.error('Error emitting socket notification:', socketError);
      // Don't fail the quiz submission if socket notification fails
    }

  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz',
      error: error.message
    });
  }
};

/**
 * Get quiz response by ID with detailed answers
 */
exports.getQuizResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user.UserID;
    const userRole = req.user.Role;

    const response = await prisma.quizResponse.findUnique({
      where: { ResponseID: parseInt(responseId) },
      include: {
        Quiz: {
          include: {
            Creator: {
              select: {
                UserID: true,
                Username: true,
                FirstName: true,
                LastName: true
              }
            }
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
        },
        Answers: {
          include: {
            Question: {
              include: {
                Options: true
              }
            },
            SelectedOption: true
          },
          orderBy: {
            Question: {
              OrderIndex: 'asc'
            }
          }
        }
      }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Quiz response not found'
      });
    }

    // Check authorization
    if (userRole !== 'teacher' && response.UserID !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this response'
      });
    }

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Get quiz response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz response',
      error: error.message
    });
  }
};

/**
 * Get all quiz responses for a user
 */
exports.getUserQuizResponses = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const { page = 1, limit = 10, quizId, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { UserID: userId };

    if (quizId) {
      where.QuizID = parseInt(quizId);
    }

    if (status) {
      where.Status = status;
    }

    const [responses, total] = await Promise.all([
      prisma.quizResponse.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          Quiz: {
            select: {
              QuizID: true,
              Title: true,
              Description: true,
              Difficulty: true,
              Subject: true,
              TotalQuestions: true
            }
          }
        },
        orderBy: {
          CreatedAt: 'desc'
        }
      }),
      prisma.quizResponse.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        responses,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get user quiz responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz responses',
      error: error.message
    });
  }
};

/**
 * Get all responses for a specific quiz (teacher only)
 */
exports.getQuizResponses = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.UserID;
    const { page = 1, limit = 10 } = req.query;

    // Check if user is teacher and owns the quiz
    const quiz = await prisma.quiz.findUnique({
      where: { QuizID: parseInt(quizId) }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (req.user.Role !== 'teacher' || quiz.CreatedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these responses'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [responses, total] = await Promise.all([
      prisma.quizResponse.findMany({
        where: { QuizID: parseInt(quizId) },
        skip,
        take: parseInt(limit),
        include: {
          User: {
            select: {
              UserID: true,
              Username: true,
              FirstName: true,
              LastName: true,
              Email: true
            }
          },
          Answers: {
            select: {
              IsCorrect: true,
              PointsEarned: true
            }
          }
        },
        orderBy: {
          CompletedAt: 'desc'
        }
      }),
      prisma.quizResponse.count({ where: { QuizID: parseInt(quizId) } })
    ]);

    // Calculate statistics
    const stats = {
      totalResponses: total,
      averageScore: 0,
      averagePercentage: 0,
      highestScore: 0,
      lowestScore: 0
    };

    if (responses.length > 0) {
      const scores = responses.map(r => r.Score);
      const percentages = responses.map(r => r.Percentage);
      
      stats.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      stats.averagePercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      stats.highestScore = Math.max(...scores);
      stats.lowestScore = Math.min(...scores);
    }

    res.status(200).json({
      success: true,
      data: {
        responses,
        stats,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get quiz responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz responses',
      error: error.message
    });
  }
};

/**
 * Generate AI insights for a quiz response
 */
exports.generateInsights = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user.UserID;

    // Fetch response with all details
    const response = await prisma.quizResponse.findUnique({
      where: { ResponseID: parseInt(responseId) },
      include: {
        Quiz: {
          include: {
            Questions: {
              include: {
                Options: true
              }
            }
          }
        },
        User: {
          select: {
            FirstName: true,
            LastName: true
          }
        },
        Answers: {
          include: {
            Question: {
              include: {
                Options: true
              }
            },
            SelectedOption: true
          }
        }
      }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Quiz response not found'
      });
    }

    // Check authorization
    if (response.UserID !== userId && req.user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate insights for this response'
      });
    }

    // Generate AI insights
    const insights = await generateAIInsights(response);

    // Update response with insights
    const updatedResponse = await prisma.quizResponse.update({
      where: { ResponseID: parseInt(responseId) },
      data: {
        AIInsights: insights,
        AIInsightsGenerated: true,
        UpdatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'AI insights generated successfully',
      data: insights
    });

  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate insights',
      error: error.message
    });
  }
};

/**
 * Get AI insights for a quiz response
 */
exports.getInsights = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user.UserID;

    const response = await prisma.quizResponse.findUnique({
      where: { ResponseID: parseInt(responseId) },
      select: {
        ResponseID: true,
        UserID: true,
        AIInsights: true,
        AIInsightsGenerated: true,
        Score: true,
        TotalScore: true,
        Percentage: true
      }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Quiz response not found'
      });
    }

    // Check authorization
    if (response.UserID !== userId && req.user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view insights for this response'
      });
    }

    if (!response.AIInsightsGenerated || !response.AIInsights) {
      return res.status(404).json({
        success: false,
        message: 'AI insights not generated yet. Please generate insights first.'
      });
    }

    res.status(200).json({
      success: true,
      data: response.AIInsights
    });

  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insights',
      error: error.message
    });
  }
};

/**
 * Delete quiz response (student can delete own, teacher can delete any)
 */
exports.deleteQuizResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    const userId = req.user.UserID;
    const userRole = req.user.Role;

    const response = await prisma.quizResponse.findUnique({
      where: { ResponseID: parseInt(responseId) },
      include: {
        Quiz: {
          select: {
            CreatedBy: true
          }
        }
      }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Quiz response not found'
      });
    }

    // Check authorization
    const isOwner = response.UserID === userId;
    const isQuizCreator = response.Quiz.CreatedBy === userId && userRole === 'teacher';

    if (!isOwner && !isQuizCreator) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this response'
      });
    }

    await prisma.quizResponse.delete({
      where: { ResponseID: parseInt(responseId) }
    });

    res.status(200).json({
      success: true,
      message: 'Quiz response deleted successfully'
    });

  } catch (error) {
    console.error('Delete quiz response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz response',
      error: error.message
    });
  }
};

/**
 * Get user's quiz performance analytics
 */
exports.getUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.UserID;

    // Get all completed responses
    const responses = await prisma.quizResponse.findMany({
      where: {
        UserID: userId,
        Status: 'completed'
      },
      include: {
        Quiz: {
          select: {
            Difficulty: true,
            Subject: true
          }
        }
      }
    });

    if (responses.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalQuizzes: 0,
          averageScore: 0,
          averagePercentage: 0,
          strongSubjects: [],
          weakSubjects: [],
          performanceByDifficulty: {}
        }
      });
    }

    // Calculate analytics
    const totalQuizzes = responses.length;
    const totalScore = responses.reduce((sum, r) => sum + r.Score, 0);
    const totalPossible = responses.reduce((sum, r) => sum + r.TotalScore, 0);
    const averageScore = totalScore / totalQuizzes;
    const averagePercentage = responses.reduce((sum, r) => sum + r.Percentage, 0) / totalQuizzes;

    // Performance by subject
    const subjectPerformance = {};
    responses.forEach(r => {
      if (r.Quiz.Subject) {
        if (!subjectPerformance[r.Quiz.Subject]) {
          subjectPerformance[r.Quiz.Subject] = {
            count: 0,
            totalPercentage: 0
          };
        }
        subjectPerformance[r.Quiz.Subject].count++;
        subjectPerformance[r.Quiz.Subject].totalPercentage += r.Percentage;
      }
    });

    const subjectStats = Object.entries(subjectPerformance).map(([subject, data]) => ({
      subject,
      averagePercentage: data.totalPercentage / data.count,
      quizzesTaken: data.count
    })).sort((a, b) => b.averagePercentage - a.averagePercentage);

    const strongSubjects = subjectStats.filter(s => s.averagePercentage >= 70).slice(0, 5);
    const weakSubjects = subjectStats.filter(s => s.averagePercentage < 70).slice(0, 5);

    // Performance by difficulty
    const difficultyPerformance = {};
    ['easy', 'medium', 'hard'].forEach(difficulty => {
      const difficultyResponses = responses.filter(r => r.Quiz.Difficulty === difficulty);
      if (difficultyResponses.length > 0) {
        difficultyPerformance[difficulty] = {
          count: difficultyResponses.length,
          averagePercentage: difficultyResponses.reduce((sum, r) => sum + r.Percentage, 0) / difficultyResponses.length
        };
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalQuizzes,
        averageScore: averageScore.toFixed(2),
        averagePercentage: averagePercentage.toFixed(2),
        strongSubjects,
        weakSubjects,
        performanceByDifficulty: difficultyPerformance,
        recentPerformance: responses.slice(-10).map(r => ({
          quizTitle: r.Quiz.Title,
          percentage: r.Percentage,
          completedAt: r.CompletedAt
        }))
      }
    });

  } catch (error) {
    console.error('Get user analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
};
