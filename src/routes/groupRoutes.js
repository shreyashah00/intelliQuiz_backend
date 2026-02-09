const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/authMiddleware');

// All group routes require authentication
router.use(authenticate);

// Teacher-only routes
router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.post('/add-students', groupController.addStudentsToGroup);
router.delete('/:GroupID/students/:UserID', groupController.removeStudentFromGroup);
router.get('/:GroupID/members', groupController.getGroupMembers);
router.delete('/:GroupID', groupController.deleteGroup);

// Search users (available to teachers)
router.get('/search-users', groupController.searchUsers);

module.exports = router;