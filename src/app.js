require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const fileRoutes = require('./routes/fileRoutes');
const quizRoutes = require('./routes/quizRoutes');
const quizResponseRoutes = require('./routes/quizResponseRoutes');
const groupRoutes = require('./routes/groupRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const socketService = require('./services/socketService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
socketService.initialize(server);

app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3500',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/quiz-responses', quizResponseRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start scheduled publishing service
  const scheduledPublishingService = require('./services/scheduledPublishingService');
  scheduledPublishingService.start();
});
