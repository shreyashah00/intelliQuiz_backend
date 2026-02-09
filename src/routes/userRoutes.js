const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/change-password', authenticate, userController.changePassword);
router.delete('/account', authenticate, userController.deleteAccount);

// Group-related routes
router.post('/groups/:GroupID/accept', authenticate, userController.acceptGroupInvitation);
router.post('/groups/:GroupID/reject', authenticate, userController.rejectGroupInvitation);
router.get('/groups', authenticate, userController.getUserGroups);

module.exports = router;
