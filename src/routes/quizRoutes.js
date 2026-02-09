const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticate } = require('../middleware/authMiddleware');

// All quiz routes require authentication
router.use(authenticate);

// Create quiz manually (teacher only)
router.post('/create', quizController.createQuiz);

// Generate quiz with AI (teacher only)
router.post('/generate-ai', quizController.generateQuizWithAI);

// Save generated quiz (teacher only)
router.post('/save-generated', quizController.saveGeneratedQuiz);

// Get all quizzes (filtered by role)
router.get('/', quizController.getQuizzes);

// Group-related routes
router.post('/publish-to-groups', quizController.publishQuizToGroups);
router.get('/scheduled', quizController.getScheduledQuizzes);
router.delete('/:quizId/groups/:groupId/scheduled', quizController.cancelScheduledPublishing);
router.get('/published-for-user', quizController.getPublishedQuizzesForUser);
router.get('/:QuizID/groups', quizController.getQuizGroups);
router.delete('/:QuizID/groups/:GroupID', quizController.removeQuizFromGroup);

// Question bank routes
router.get('/questions/bank', quizController.getQuestionBank);

// Get quiz by ID
router.get('/:quizId', quizController.getQuizById);

// Update quiz (teacher only, own quizzes)
router.put('/:quizId', quizController.updateQuiz);

// Delete quiz (teacher only, own quizzes)
router.delete('/:quizId', quizController.deleteQuiz);

module.exports = router;