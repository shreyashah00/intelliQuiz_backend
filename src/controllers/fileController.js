const { default: prisma } = require('../lib/prismaClient');
const fs = require('fs').promises;
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

// Chunk size configuration (in characters)
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

/**
 * Split text into overlapping chunks
 */
const splitTextIntoChunks = (text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) => {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    start += chunkSize - overlap;
  }
  
  return chunks;
};

/**
 * Extract text from PDF file
 */
const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const pdfParser = new PDFParse({ data: dataBuffer });
    const data = await pdfParser.getText();
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

/**
 * Extract text from DOCX file
 */
const extractTextFromDOCX = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
};

/**
 * Upload and process file
 */
exports.uploadFile = async (req, res) => {
  let tempFilePath = null;
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const userId = req.user.UserID;
    const file = req.file;
    tempFilePath = file.path;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.mimetype)) {
      await fs.unlink(tempFilePath);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF and DOCX files are allowed'
      });
    }

    // Create file record in database
    const fileRecord = await prisma.file.create({
      data: {
        UserID: userId,
        FileName: file.originalname,
        FileType: file.mimetype,
        FileSize: file.size,
        Status: 'processing'
      }
    });

    // Extract text based on file type
    let extractedText = '';
    
    if (file.mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(tempFilePath);
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractTextFromDOCX(tempFilePath);
    }

    // Clean and normalize text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    if (!extractedText || extractedText.length === 0) {
      await prisma.file.update({
        where: { FileID: fileRecord.FileID },
        data: { Status: 'failed' }
      });
      
      await fs.unlink(tempFilePath);
      
      return res.status(400).json({
        success: false,
        message: 'No text could be extracted from the file'
      });
    }

    // Split text into chunks
    const chunks = splitTextIntoChunks(extractedText);

    // Store chunks in database
    const chunkPromises = chunks.map((chunk, index) => 
      prisma.chunk.create({
        data: {
          FileID: fileRecord.FileID,
          ChunkIndex: index,
          Content: chunk
        }
      })
    );

    await Promise.all(chunkPromises);

    // Update file record with completion status
    const updatedFile = await prisma.file.update({
      where: { FileID: fileRecord.FileID },
      data: {
        TotalChunks: chunks.length,
        Status: 'completed',
        ProcessedAt: new Date()
      },
      include: {
        Chunks: {
          select: {
            ChunkID: true,
            ChunkIndex: true
          },
          orderBy: {
            ChunkIndex: 'asc'
          }
        }
      }
    });

    // Delete temporary file
    await fs.unlink(tempFilePath);

    res.status(201).json({
      success: true,
      message: 'File uploaded and processed successfully',
      data: {
        fileId: updatedFile.FileID,
        fileName: updatedFile.FileName,
        fileType: updatedFile.FileType,
        fileSize: updatedFile.FileSize,
        totalChunks: updatedFile.TotalChunks,
        status: updatedFile.Status,
        uploadedAt: updatedFile.UploadedAt,
        processedAt: updatedFile.ProcessedAt
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up temporary file if it exists
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('Error deleting temp file:', unlinkError);
      }
    }

    // Update file status to failed if record was created
    if (req.file) {
      try {
        const files = await prisma.file.findMany({
          where: {
            UserID: req.user.UserID,
            FileName: req.file.originalname,
            Status: 'processing'
          },
          orderBy: {
            UploadedAt: 'desc'
          },
          take: 1
        });

        if (files.length > 0) {
          await prisma.file.update({
            where: { FileID: files[0].FileID },
            data: { Status: 'failed' }
          });
        }
      } catch (dbError) {
        console.error('Error updating file status:', dbError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: error.message
    });
  }
};

/**
 * Get all files for the authenticated user
 */
exports.getUserFiles = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const { status, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build filter
    const where = { UserID: userId };
    if (status) {
      where.Status = status;
    }

    // Get files with pagination
    const [files, totalCount] = await Promise.all([
      prisma.file.findMany({
        where,
        skip,
        take,
        orderBy: {
          UploadedAt: 'desc'
        },
        select: {
          FileID: true,
          FileName: true,
          FileType: true,
          FileSize: true,
          TotalChunks: true,
          Status: true,
          UploadedAt: true,
          ProcessedAt: true
        }
      }),
      prisma.file.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        files,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching files',
      error: error.message
    });
  }
};

/**
 * Get a specific file with its chunks
 */
exports.getFileById = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const { fileId } = req.params;

    const file = await prisma.file.findFirst({
      where: {
        FileID: parseInt(fileId),
        UserID: userId
      },
      include: {
        Chunks: {
          orderBy: {
            ChunkIndex: 'asc'
          },
          select: {
            ChunkID: true,
            ChunkIndex: true,
            Content: true,
            CreatedAt: true
          }
        }
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.status(200).json({
      success: true,
      data: file
    });

  } catch (error) {
    console.error('Get file by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching file',
      error: error.message
    });
  }
};

/**
 * Delete a file and its chunks
 */
exports.deleteFile = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const { fileId } = req.params;

    // Check if file exists and belongs to user
    const file = await prisma.file.findFirst({
      where: {
        FileID: parseInt(fileId),
        UserID: userId
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file (chunks will be deleted automatically due to cascade)
    await prisma.file.delete({
      where: { FileID: parseInt(fileId) }
    });

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message
    });
  }
};

/**
 * Get file statistics for the user
 */
exports.getFileStats = async (req, res) => {
  try {
    const userId = req.user.UserID;

    const [totalFiles, completedFiles, processingFiles, failedFiles, totalSize] = await Promise.all([
      prisma.file.count({
        where: { UserID: userId }
      }),
      prisma.file.count({
        where: { UserID: userId, Status: 'completed' }
      }),
      prisma.file.count({
        where: { UserID: userId, Status: 'processing' }
      }),
      prisma.file.count({
        where: { UserID: userId, Status: 'failed' }
      }),
      prisma.file.aggregate({
        where: { UserID: userId },
        _sum: {
          FileSize: true
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalFiles,
        completedFiles,
        processingFiles,
        failedFiles,
        totalSize: totalSize._sum.FileSize || 0
      }
    });

  } catch (error) {
    console.error('Get file stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching file statistics',
      error: error.message
    });
  }
};
