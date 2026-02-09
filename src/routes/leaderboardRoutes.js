const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { authenticate } = require('../middleware/authMiddleware');

// All leaderboard routes require authentication
router.use(authenticate);

// Get leaderboard for a specific quiz (teacher only)
router.get('/quiz/:quizId', leaderboardController.getQuizLeaderboard);

// Get leaderboard for all quizzes in a group (teacher only)
router.get('/group/:groupId', leaderboardController.getGroupLeaderboard);

// Get recent submissions for teacher dashboard
router.get('/recent-submissions', leaderboardController.getRecentSubmissions);

module.exports = router;