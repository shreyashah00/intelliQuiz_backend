const { default: prisma } = require('../lib/prismaClient');
const { generateQuizWithAI } = require('../services/quizService');
const scheduledPublishingService = require('../services/scheduledPublishingService');

/**
 * Create a quiz manually (teacher only)
 */
exports.createQuiz = async (req, res) => {
  try {
    const { title, description, difficulty, subject, timeLimit, questions } = req.body;
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can create quizzes'
      });
    }

    // Validate input
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and questions are required'
      });
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (difficulty && !validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty. Must be easy, medium, or hard'
      });
    }

    // Create quiz
    const quiz = await prisma.quiz.create({
      data: {
        Title: title,
        Description: description,
        Difficulty: difficulty || 'medium',
        Subject: subject,
        TimeLimit: timeLimit,
        TotalQuestions: questions.length,
        CreatedBy: teacherId,
        IsPublished: false
      }
    });

    // Create questions and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      if (!q.questionText || !q.options || !Array.isArray(q.options) || q.options.length < 2) {
        // Clean up created quiz if validation fails
        await prisma.quiz.delete({ where: { QuizID: quiz.QuizID } });
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} must have questionText and at least 2 options`
        });
      }

      // Find correct answer
      const correctOptionIndex = q.options.findIndex(opt => opt.isCorrect);
      if (correctOptionIndex === -1) {
        await prisma.quiz.delete({ where: { QuizID: quiz.QuizID } });
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} must have exactly one correct answer`
        });
      }

      const question = await prisma.question.create({
        data: {
          QuizID: quiz.QuizID,
          QuestionText: q.questionText,
          QuestionType: q.questionType || 'multiple_choice',
          Points: q.points || 1,
          OrderIndex: i
        }
      });

      // Create options
      for (let j = 0; j < q.options.length; j++) {
        const option = q.options[j];
        await prisma.option.create({
          data: {
            QuestionID: question.QuestionID,
            OptionText: option.text,
            IsCorrect: option.isCorrect || false,
            OrderIndex: j
          }
        });
      }
    }

    // Return created quiz with questions and options
    const createdQuiz = await prisma.quiz.findUnique({
      where: { QuizID: quiz.QuizID },
      include: {
        Questions: {
          include: {
            Options: {
              orderBy: { OrderIndex: 'asc' }
            }
          },
          orderBy: { OrderIndex: 'asc' }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      data: createdQuiz
    });

  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quiz',
      error: error.message
    });
  }
};

/**
 * Generate quiz with AI from files (teacher only)
 */
exports.generateQuizWithAI = async (req, res) => {
  try {
    const { fileIds, title, description, difficulty, subject, timeLimit, numQuestions } = req.body;
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can generate quizzes'
      });
    }

    // Validate input
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one file ID is required'
      });
    }

    if (!title || !numQuestions || numQuestions < 1 || numQuestions > 50) {
      return res.status(400).json({
        success: false,
        message: 'Title and valid number of questions (1-50) are required'
      });
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (difficulty && !validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty. Must be easy, medium, or hard'
      });
    }

    // Get file chunks
    const files = await prisma.file.findMany({
      where: {
        FileID: { in: fileIds },
        UserID: teacherId,
        Status: 'completed'
      },
      include: {
        Chunks: {
          orderBy: { ChunkIndex: 'asc' }
        }
      }
    });

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid files found'
      });
    }

    // Combine all chunks content
    let combinedContent = '';
    files.forEach(file => {
      file.Chunks.forEach(chunk => {
        combinedContent += chunk.Content + ' ';
      });
    });

    if (combinedContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Files contain no readable content'
      });
    }

    // Generate quiz with AI
    const aiResponse = await generateQuizWithAI({
      content: combinedContent,
      title,
      description,
      difficulty: difficulty || 'medium',
      subject,
      numQuestions,
      timeLimit
    });

    res.status(200).json({
      success: true,
      message: 'Quiz generated successfully',
      data: aiResponse
    });

  } catch (error) {
    console.error('Generate quiz with AI error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz with AI',
      error: error.message
    });
  }
};

/**
 * Save generated quiz (teacher only)
 */
exports.saveGeneratedQuiz = async (req, res) => {
  try {
    const { title, description, difficulty, subject, timeLimit, questions } = req.body;
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can save quizzes'
      });
    }

    // Validate input
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and questions are required'
      });
    }

    // Create quiz
    const quiz = await prisma.quiz.create({
      data: {
        Title: title,
        Description: description,
        Difficulty: difficulty || 'medium',
        Subject: subject,
        TimeLimit: timeLimit,
        TotalQuestions: questions.length,
        CreatedBy: teacherId,
        IsPublished: false
      }
    });

    // Create questions and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      const question = await prisma.question.create({
        data: {
          QuizID: quiz.QuizID,
          QuestionText: q.question,
          QuestionType: 'multiple_choice',
          Points: q.points || 1,
          OrderIndex: i
        }
      });

      // Create options
      for (let j = 0; j < q.options.length; j++) {
        const option = q.options[j];
        await prisma.option.create({
          data: {
            QuestionID: question.QuestionID,
            OptionText: option,
            IsCorrect: j === q.correctAnswer,
            OrderIndex: j
          }
        });
      }
    }

    // Return created quiz
    const createdQuiz = await prisma.quiz.findUnique({
      where: { QuizID: quiz.QuizID },
      include: {
        Questions: {
          include: {
            Options: {
              orderBy: { OrderIndex: 'asc' }
            }
          },
          orderBy: { OrderIndex: 'asc' }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Quiz saved successfully',
      data: createdQuiz
    });

  } catch (error) {
    console.error('Save generated quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save quiz',
      error: error.message
    });
  }
};

/**
 * Get all quizzes (students see published, teachers see their own)
 */
exports.getQuizzes = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const user = await prisma.user.findUnique({
      where: { UserID: userId }
    });

    let whereClause = {};

    if (user.Role === 'student') {
      whereClause = { IsPublished: true };
    } else if (user.Role === 'teacher') {
      whereClause = { CreatedBy: userId };
    }

    const quizzes = await prisma.quiz.findMany({
      where: whereClause,
      include: {
        Creator: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true
          }
        },
        _count: {
          select: { Questions: true }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: quizzes
    });

  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quizzes',
      error: error.message
    });
  }
};

/**
 * Get quiz by ID with questions and options
 */
exports.getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.UserID;

    // Validate quizId parameter
    if (!quizId || quizId.trim() === '' || isNaN(parseInt(quizId))) {
      return res.status(400).json({
        success: false,
        message: `Invalid quiz ID: "${quizId}"`
      });
    }

    const parsedQuizId = parseInt(quizId);
    
    if (parsedQuizId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID must be a positive number'
      });
    }

    const user = await prisma.user.findUnique({
      where: { UserID: userId }
    });

    const quiz = await prisma.quiz.findFirst({
      where: {
        AND: [
          { QuizID: parsedQuizId },
          {
            OR: [
              { IsPublished: true },
              { CreatedBy: userId }
            ]
          }
        ]
      },
      include: {
        Creator: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true
          }
        },
        Questions: {
          include: {
            Options: {
              orderBy: { OrderIndex: 'asc' }
            }
          },
          orderBy: { OrderIndex: 'asc' }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // For students, don't include correct answers
    if (user.Role === 'student') {
      quiz.Questions = quiz.Questions.map(question => ({
        ...question,
        Options: question.Options.map(option => ({
          OptionID: option.OptionID,
          OptionText: option.OptionText,
          OrderIndex: option.OrderIndex
          // Exclude IsCorrect for students
        }))
      }));
    }

    res.status(200).json({
      success: true,
      data: quiz
    });

  } catch (error) {
    console.error('Get quiz by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz',
      error: error.message
    });
  }
};

/**
 * Update quiz (teacher only, only own quizzes)
 */
exports.updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, description, difficulty, subject, timeLimit, isPublished } = req.body;
    const teacherId = req.user.UserID;

    // Validate quizId parameter
    if (!quizId || isNaN(parseInt(quizId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID'
      });
    }

    const parsedQuizId = parseInt(quizId);

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can update quizzes'
      });
    }

    // Check if quiz exists and belongs to teacher
    const existingQuiz = await prisma.quiz.findFirst({
      where: {
        QuizID: parsedQuizId,
        CreatedBy: teacherId
      }
    });

    if (!existingQuiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or access denied'
      });
    }

    // Update quiz
    const updatedQuiz = await prisma.quiz.update({
      where: { QuizID: parsedQuizId },
      data: {
        ...(title && { Title: title }),
        ...(description !== undefined && { Description: description }),
        ...(difficulty && { Difficulty: difficulty }),
        ...(subject !== undefined && { Subject: subject }),
        ...(timeLimit !== undefined && { TimeLimit: timeLimit }),
        ...(isPublished !== undefined && { IsPublished: isPublished })
      },
      include: {
        Creator: {
          select: {
            UserID: true,
            Username: true,
            FirstName: true,
            LastName: true
          }
        },
        _count: {
          select: { Questions: true }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Quiz updated successfully',
      data: updatedQuiz
    });

  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz',
      error: error.message
    });
  }
};

/**
 * Delete quiz (teacher only, only own quizzes)
 */
exports.deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user.UserID;

    // Validate quizId parameter
    if (!quizId || isNaN(parseInt(quizId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID'
      });
    }

    const parsedQuizId = parseInt(quizId);

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can delete quizzes'
      });
    }

    // Check if quiz exists and belongs to teacher
    const existingQuiz = await prisma.quiz.findFirst({
      where: {
        QuizID: parsedQuizId,
        CreatedBy: teacherId
      }
    });

    if (!existingQuiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or access denied'
      });
    }

    // Delete quiz (cascade will handle questions and options)
    await prisma.quiz.delete({
      where: { QuizID: parsedQuizId }
    });

    res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully'
    });

  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz',
      error: error.message
    });
  }
};

/**
 * Publish quiz to groups
 */
exports.publishQuizToGroups = async (req, res) => {
  try {
    const { QuizID, GroupIDs, scheduledAt, isScheduled } = req.body;
    const teacherId = req.user.UserID;

    // Validate input
    if (!QuizID || !Array.isArray(GroupIDs) || GroupIDs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID and group IDs are required'
      });
    }

    // Validate scheduling parameters
    if (isScheduled) {
      if (!scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled time is required when scheduling is enabled'
        });
      }

      const scheduledTime = new Date(scheduledAt);
      const now = new Date();

      if (scheduledTime <= now) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled time must be in the future'
        });
      }
    }

    // Verify quiz ownership
    const quiz = await prisma.quiz.findFirst({
      where: { QuizID, CreatedBy: teacherId }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or access denied'
      });
    }

    // Verify groups belong to the teacher
    const groups = await prisma.group.findMany({
      where: {
        GroupID: { in: GroupIDs },
        CreatedBy: teacherId
      }
    });

    if (groups.length !== GroupIDs.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more groups not found or access denied'
      });
    }

    // Check for existing publications to avoid duplicates
    const existingPublications = await prisma.quizGroup.findMany({
      where: {
        QuizID,
        GroupID: { in: GroupIDs }
      },
      select: { GroupID: true, Status: true }
    });

    const existingGroupIds = existingPublications.map(pub => pub.GroupID);
    const newGroupIds = GroupIDs.filter(id => !existingGroupIds.includes(id));

    if (newGroupIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quiz is already published to all selected groups'
      });
    }

    // Handle scheduled vs immediate publishing
    if (isScheduled) {
      // Schedule the quiz for future publishing
      const scheduledResults = [];
      for (const groupId of newGroupIds) {
        try {
          const result = await scheduledPublishingService.scheduleQuizPublishing(
            QuizID,
            groupId,
            scheduledAt
          );
          scheduledResults.push(result);
        } catch (error) {
          console.error(`Error scheduling quiz for group ${groupId}:`, error);
        }
      }

      return res.json({
        success: true,
        message: `Quiz scheduled for publishing to ${scheduledResults.length} group(s) at ${new Date(scheduledAt).toLocaleString()}`,
        data: {
          quizId: QuizID,
          scheduledToGroups: scheduledResults.length,
          scheduledAt: scheduledAt,
          groupNames: groups.filter(g => newGroupIds.includes(g.GroupID)).map(g => g.Name)
        }
      });

    } else {
      // Publish immediately
      const quizGroups = await prisma.quizGroup.createMany({
        data: newGroupIds.map(groupId => ({
          QuizID,
          GroupID: groupId,
          Status: 'published',
          PublishedAt: new Date()
        }))
      });

      // Update quiz as published if not already
      if (!quiz.IsPublished) {
        await prisma.quiz.update({
          where: { QuizID },
          data: { IsPublished: true }
        });
      }

      res.json({
        success: true,
        message: `Quiz published to ${newGroupIds.length} group(s) successfully`,
        data: {
          quizId: QuizID,
          publishedToGroups: newGroupIds.length,
          groupNames: groups.filter(g => newGroupIds.includes(g.GroupID)).map(g => g.Name)
        }
      });
    }
  } catch (error) {
    console.error('Publish quiz to groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while publishing quiz to groups'
    });
  }
};

/**
 * Unpublish a quiz (teacher only, own quizzes)
 */
exports.unpublishQuiz = async (req, res) => {
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
        message: 'Only teachers can unpublish quizzes'
      });
    }

    // Verify quiz ownership
    const quiz = await prisma.quiz.findFirst({
      where: { QuizID: parseInt(quizId), CreatedBy: teacherId }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or access denied'
      });
    }

    if (!quiz.IsPublished) {
      return res.status(400).json({
        success: false,
        message: 'Quiz is not published'
      });
    }

    // Remove quiz from all groups (set status to cancelled for published ones)
    await prisma.quizGroup.updateMany({
      where: { QuizID: parseInt(quizId), Status: 'published' },
      data: { Status: 'cancelled' }
    });

    // Cancel any scheduled publications
    await prisma.quizGroup.updateMany({
      where: { QuizID: parseInt(quizId), Status: 'scheduled' },
      data: { Status: 'cancelled' }
    });

    // Update quiz as unpublished
    await prisma.quiz.update({
      where: { QuizID: parseInt(quizId) },
      data: { IsPublished: false }
    });

    res.json({
      success: true,
      message: 'Quiz unpublished successfully'
    });
  } catch (error) {
    console.error('Unpublish quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unpublishing quiz'
    });
  }
};

/**
 * Get scheduled quizzes for a teacher
 */
exports.getScheduledQuizzes = async (req, res) => {
  try {
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view scheduled quizzes'
      });
    }

    const scheduledQuizzes = await scheduledPublishingService.getScheduledQuizzesForTeacher(teacherId);

    res.json({
      success: true,
      data: scheduledQuizzes
    });
  } catch (error) {
    console.error('Get scheduled quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving scheduled quizzes'
    });
  }
};

/**
 * Cancel scheduled quiz publishing
 */
exports.cancelScheduledPublishing = async (req, res) => {
  try {
    const { quizId, groupId } = req.params;
    const teacherId = req.user.UserID;

    // Validate teacher role and ownership
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can cancel scheduled publishing'
      });
    }

    // Verify quiz ownership
    const quiz = await prisma.quiz.findFirst({
      where: { QuizID: parseInt(quizId), CreatedBy: teacherId }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or access denied'
      });
    }

    await scheduledPublishingService.cancelScheduledPublishing(parseInt(quizId), parseInt(groupId));

    res.json({
      success: true,
      message: 'Scheduled publishing cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel scheduled publishing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while cancelling scheduled publishing'
    });
  }
};

/**
 * Get question bank for a teacher (all questions they've created)
 */
exports.getQuestionBank = async (req, res) => {
  try {
    const teacherId = req.user.UserID;
    const { page = 1, limit = 20, subject, difficulty, questionType, search } = req.query;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can access question bank'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      Quiz: {
        CreatedBy: teacherId
      }
    };

    if (subject) {
      whereClause.Quiz.Subject = subject;
    }

    if (questionType) {
      whereClause.QuestionType = questionType;
    }

    if (search) {
      whereClause.QuestionText = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Get questions with filtering and pagination
    const questions = await prisma.question.findMany({
      where: whereClause,
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            Subject: true,
            Difficulty: true,
            CreatedAt: true
          }
        },
        Options: {
          select: {
            OptionID: true,
            OptionText: true,
            IsCorrect: true,
            OrderIndex: true
          },
          orderBy: {
            OrderIndex: 'asc'
          }
        },
        _count: {
          select: {
            Answers: true
          }
        }
      },
      orderBy: {
        CreatedAt: 'desc'
      },
      skip: offset,
      take: limitNum
    });

    // Get total count for pagination
    const totalQuestions = await prisma.question.count({
      where: whereClause
    });

    // Get subject and question type statistics
    const stats = await prisma.question.groupBy({
      by: ['QuestionType'],
      where: {
        Quiz: {
          CreatedBy: teacherId
        }
      },
      _count: {
        QuestionID: true
      }
    });

    const subjectStats = await prisma.quiz.groupBy({
      by: ['Subject'],
      where: {
        CreatedBy: teacherId,
        Questions: {
          some: {} // Only quizzes that have questions
        }
      },
      _count: {
        QuizID: true
      }
    });

    // Format the response
    const formattedQuestions = questions.map(question => ({
      questionId: question.QuestionID,
      questionText: question.QuestionText,
      questionType: question.QuestionType,
      points: question.Points,
      orderIndex: question.OrderIndex,
      usageCount: question._count.Answers,
      createdAt: question.CreatedAt,
      quiz: {
        quizId: question.Quiz.QuizID,
        title: question.Quiz.Title,
        subject: question.Quiz.Subject,
        difficulty: question.Quiz.Difficulty,
        createdAt: question.Quiz.CreatedAt
      },
      options: question.Options.map(option => ({
        optionId: option.OptionID,
        text: option.OptionText,
        isCorrect: option.IsCorrect,
        orderIndex: option.OrderIndex
      }))
    }));

    res.json({
      success: true,
      data: {
        questions: formattedQuestions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalQuestions,
          totalPages: Math.ceil(totalQuestions / limitNum)
        },
        stats: {
          questionTypes: stats,
          subjects: subjectStats
        }
      }
    });
  } catch (error) {
    console.error('Get question bank error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving question bank'
    });
  }
};

/**
 * Get published quizzes for a user (based on their groups)
 */
exports.getPublishedQuizzesForUser = async (req, res) => {
  try {
    const userId = req.user.UserID;

    // Get all groups the user is a member of
    const userGroups = await prisma.groupMember.findMany({
      where: {
        UserID: userId,
        Status: 'accepted'
      },
      select: { GroupID: true }
    });

    const groupIds = userGroups.map(member => member.GroupID);

    if (groupIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get quizzes published to these groups
    const quizGroups = await prisma.quizGroup.findMany({
      where: {
        GroupID: { in: groupIds },
        Status: 'published'
      },
      include: {
        Quiz: {
          select: {
            QuizID: true,
            Title: true,
            Description: true,
            Difficulty: true,
            Subject: true,
            TimeLimit: true,
            TotalQuestions: true,
            CreatedAt: true,
            Creator: {
              select: {
                Username: true,
                FirstName: true,
                LastName: true
              }
            }
          }
        },
        Group: {
          select: {
            GroupID: true,
            Name: true
          }
        }
      },
      orderBy: { PublishedAt: 'desc' }
    });

    // Remove duplicates (same quiz published to multiple groups)
    const uniqueQuizzes = [];
    const seenQuizIds = new Set();

    for (const quizGroup of quizGroups) {
      if (!seenQuizIds.has(quizGroup.Quiz.QuizID)) {
        uniqueQuizzes.push({
          ...quizGroup.Quiz,
          publishedToGroups: [quizGroup.Group],
          publishedAt: quizGroup.PublishedAt
        });
        seenQuizIds.add(quizGroup.Quiz.QuizID);
      } else {
        // Add group to existing quiz
        const existingQuiz = uniqueQuizzes.find(q => q.QuizID === quizGroup.Quiz.QuizID);
        existingQuiz.publishedToGroups.push(quizGroup.Group);
      }
    }

    res.json({
      success: true,
      data: uniqueQuizzes
    });
  } catch (error) {
    console.error('Get published quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching published quizzes'
    });
  }
};

/**
 * Get groups a quiz is published to
 */
exports.getQuizGroups = async (req, res) => {
  try {
    const { QuizID } = req.params;
    const teacherId = req.user.UserID;

    // Validate QuizID parameter
    if (!QuizID || isNaN(parseInt(QuizID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID'
      });
    }

    const parsedQuizId = parseInt(QuizID);

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

    const quizGroups = await prisma.quizGroup.findMany({
      where: { QuizID: parsedQuizId },
      include: {
        Group: {
          select: {
            GroupID: true,
            Name: true,
            Description: true,
            _count: {
              select: { Members: true }
            }
          }
        }
      },
      orderBy: { PublishedAt: 'desc' }
    });

    res.json({
      success: true,
      data: quizGroups.map(qg => ({
        ...qg.Group,
        publishedAt: qg.PublishedAt,
        memberCount: qg.Group._count.Members
      }))
    });
  } catch (error) {
    console.error('Get quiz groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching quiz groups'
    });
  }
};

/**
 * Remove quiz from a group
 */
exports.removeQuizFromGroup = async (req, res) => {
  try {
    const { QuizID, GroupID } = req.params;
    const teacherId = req.user.UserID;

    // Validate QuizID and GroupID parameters
    if (!QuizID || isNaN(parseInt(QuizID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quiz ID'
      });
    }

    if (!GroupID || isNaN(parseInt(GroupID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const parsedQuizId = parseInt(QuizID);
    const parsedGroupId = parseInt(GroupID);

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

    const deletedPublication = await prisma.quizGroup.deleteMany({
      where: {
        QuizID: parsedQuizId,
        GroupID: parsedGroupId
      }
    });

    if (deletedPublication.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz is not published to this group'
      });
    }

    res.json({
      success: true,
      message: 'Quiz removed from group successfully'
    });
  } catch (error) {
    console.error('Remove quiz from group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing quiz from group'
    });
  }
};