const bcrypt = require('bcryptjs');
const { default: prisma } = require('../lib/prismaClient');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        UserID: true,
        Username: true,
        Email: true,
        Role: true,
        FirstName: true,
        LastName: true,
        PhoneNumber: true,
        ProfilePicture: true,
        Bio: true,
        EmailVerified: true,
        AccountStatus: true,
        CreatedAt: true,
        UpdatedAt: true,
        LastLogin: true,
        _count: {
          select: {
            CreatedQuizzes: true,
            QuizResponses: true,
            Files: true
          }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
};

// Update user account status (activate/deactivate)
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accountStatus } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account status. Must be active, inactive, or suspended'
      });
    }

    const user = await prisma.user.findUnique({
      where: { UserID: parseInt(userId) }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (user.UserID === req.user.UserID && accountStatus !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { UserID: parseInt(userId) },
      data: { AccountStatus: accountStatus },
      select: {
        UserID: true,
        Username: true,
        Email: true,
        Role: true,
        AccountStatus: true
      }
    });

    res.json({
      success: true,
      message: `User account ${accountStatus}`,
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user status'
    });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be student, teacher, or admin'
      });
    }

    const user = await prisma.user.findUnique({
      where: { UserID: parseInt(userId) }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent changing own role to non-admin
    if (user.UserID === req.user.UserID && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { UserID: parseInt(userId) },
      data: { Role: role },
      select: {
        UserID: true,
        Username: true,
        Email: true,
        Role: true
      }
    });

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user role'
    });
  }
};

// Create admin user
exports.createAdminUser = async (req, res) => {
  try {
    const { Username, Email, Password, FirstName, LastName } = req.body;

    if (!Username || !Email || !Password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ Email }, { Username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.Email === Email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(Password, saltRounds);

    const newAdmin = await prisma.user.create({
      data: {
        Username,
        Email,
        Password: hashedPassword,
        Role: 'admin',
        FirstName,
        LastName,
        EmailVerified: true, // Auto-verify admin accounts
        AccountStatus: 'active'
      },
      select: {
        UserID: true,
        Username: true,
        Email: true,
        Role: true,
        FirstName: true,
        LastName: true,
        CreatedAt: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: newAdmin
    });
  } catch (error) {
    console.error('Create admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating admin user'
    });
  }
};

// Get system usage statistics
exports.getSystemStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalQuizzes,
      publishedQuizzes,
      totalQuizResponses,
      totalFiles
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { AccountStatus: 'active' } }),
      prisma.quiz.count(),
      prisma.quiz.count({ where: { IsPublished: true } }),
      prisma.quizResponse.count(),
      prisma.file.count()
    ]);

    // Get user role distribution
    const userRoles = await prisma.user.groupBy({
      by: ['Role'],
      _count: { Role: true }
    });

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await prisma.user.count({
      where: { CreatedAt: { gte: thirtyDaysAgo } }
    });

    const recentQuizzes = await prisma.quiz.count({
      where: { CreatedAt: { gte: thirtyDaysAgo } }
    });

    const recentResponses = await prisma.quizResponse.count({
      where: { CreatedAt: { gte: thirtyDaysAgo } }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          totalQuizzes,
          publishedQuizzes,
          totalQuizResponses,
          totalFiles
        },
        userRoles: userRoles.reduce((acc, role) => {
          acc[role.Role] = role._count.Role;
          return acc;
        }, {}),
        recentActivity: {
          newUsers: recentUsers,
          newQuizzes: recentQuizzes,
          quizResponses: recentResponses
        }
      }
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching system statistics'
    });
  }
};

// Get all quizzes (admin read-only)
exports.getAllQuizzes = async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: {
        Creator: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true,
            Role: true
          }
        },
        _count: {
          select: {
            Questions: true,
            Responses: true
          }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    res.json({
      success: true,
      data: quizzes
    });
  } catch (error) {
    console.error('Get all quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching quizzes'
    });
  }
};

// Get all questions (admin read-only)
exports.getAllQuestions = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            IsPublished: true,
            Creator: {
              select: {
                Username: true,
                FirstName: true,
                LastName: true
              }
            }
          }
        },
        Options: {
          select: {
            OptionID: true,
            OptionText: true,
            IsCorrect: true,
            OrderIndex: true
          },
          orderBy: { OrderIndex: 'asc' }
        },
        _count: {
          select: {
            Answers: true
          }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Get all questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching questions'
    });
  }
};