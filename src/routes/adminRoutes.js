const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// User management routes
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/status', adminController.updateUserStatus);
router.put('/users/:userId/role', adminController.updateUserRole);

// Create admin user route
// router.post('/users', adminController.createAdminUser);

// System monitoring routes
router.get('/stats', adminController.getSystemStats);

// Quiz and question read-only routes
router.get('/quizzes', adminController.getAllQuizzes);
router.get('/questions', adminController.getAllQuestions);

module.exports = router;