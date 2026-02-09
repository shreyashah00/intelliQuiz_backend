const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fileController = require('../controllers/fileController');
const { authenticate } = require('../middleware/authMiddleware');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'temp-' + uniqueSuffix + ext);
  }
});

// File filter to accept only PDF and DOCX
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and DOCX files are allowed'), false);
  }
};

// Configure multer upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Routes

/**
 * @route   POST /api/files/upload
 * @desc    Upload and process a file (PDF or DOCX)
 * @access  Private
 */
router.post('/upload', authenticate, upload.single('file'), fileController.uploadFile);

/**
 * @route   GET /api/files
 * @desc    Get all files for the authenticated user
 * @access  Private
 */
router.get('/', authenticate, fileController.getUserFiles);

/**
 * @route   GET /api/files/stats
 * @desc    Get file statistics for the user
 * @access  Private
 */
router.get('/stats', authenticate, fileController.getFileStats);

/**
 * @route   GET /api/files/:fileId
 * @desc    Get a specific file with its chunks
 * @access  Private
 */
router.get('/:fileId', authenticate, fileController.getFileById);

/**
 * @route   DELETE /api/files/:fileId
 * @desc    Delete a file and its chunks
 * @access  Private
 */
router.delete('/:fileId', authenticate, fileController.deleteFile);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next();
});

module.exports = router;
