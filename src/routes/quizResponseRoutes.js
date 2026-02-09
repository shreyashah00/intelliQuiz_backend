const express = require('express');
const router = express.Router();
const quizResponseController = require('../controllers/quizResponseController');
const { authenticate } = require('../middleware/authMiddleware');

// All quiz response routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/quiz-responses/submit
 * @desc    Submit a quiz response with all answers
 * @access  Private (Student)
 */
router.post('/submit', quizResponseController.submitQuizResponse);

/**
 * @route   GET /api/quiz-responses/my-responses
 * @desc    Get all quiz responses for the authenticated user
 * @access  Private
 * @query   page, limit, quizId, status
 */
router.get('/my-responses', quizResponseController.getUserQuizResponses);

/**
 * @route   GET /api/quiz-responses/my-analytics
 * @desc    Get performance analytics for the authenticated user
 * @access  Private
 */
router.get('/my-analytics', quizResponseController.getUserAnalytics);

/**
 * @route   GET /api/quiz-responses/:responseId
 * @desc    Get a specific quiz response by ID with detailed answers
 * @access  Private (Owner or Teacher)
 */
router.get('/:responseId', quizResponseController.getQuizResponse);

/**
 * @route   POST /api/quiz-responses/:responseId/generate-insights
 * @desc    Generate AI-powered insights for a quiz response
 * @access  Private (Owner or Teacher)
 */
router.post('/:responseId/generate-insights', quizResponseController.generateInsights);

/**
 * @route   GET /api/quiz-responses/:responseId/insights
 * @desc    Get AI insights for a quiz response
 * @access  Private (Owner or Teacher)
 */
router.get('/:responseId/insights', quizResponseController.getInsights);

/**
 * @route   DELETE /api/quiz-responses/:responseId
 * @desc    Delete a quiz response
 * @access  Private (Owner or Quiz Creator)
 */
router.delete('/:responseId', quizResponseController.deleteQuizResponse);

/**
 * @route   GET /api/quiz-responses/quiz/:quizId
 * @desc    Get all responses for a specific quiz (Teacher only)
 * @access  Private (Teacher - Quiz Creator)
 */
router.get('/quiz/:quizId', quizResponseController.getQuizResponses);

module.exports = router;
