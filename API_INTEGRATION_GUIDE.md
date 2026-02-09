# IntelliQuiz API Integration Guide

## Overview

This guide provides comprehensive documentation for integrating with the IntelliQuiz backend API. The API supports quiz management, user authentication, file processing, group management, and real-time leaderboard updates.

## Base URL

```
http://localhost:5000/api
```

## Authentication

All API requests require authentication using JWT tokens in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Socket.IO Integration

### Connection Setup

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: "your_jwt_token", // Send JWT token for authentication
  },
});

// Authenticate user
socket.emit("authenticate", userId);

// Join quiz room for real-time leaderboard updates
socket.emit("joinQuizRoom", quizId);

// Join teacher room for submission notifications
socket.emit("joinTeacherRoom");
```

### Socket Events

#### For Teachers

```javascript
// Listen for new quiz submissions
socket.on("submissionNotification", (data) => {
  console.log("New submission:", data);
  // data: { quizId, userId, score, totalScore, percentage, submittedAt }
});

// Listen for leaderboard updates in specific quiz
socket.on("leaderboardUpdate", (data) => {
  console.log("Leaderboard update:", data);
  // data: { type: 'newSubmission', data: { userId, username, fullName, score, totalScore, percentage, submittedAt } }
});
```

## API Endpoints

### Authentication

#### POST /auth/register

Register a new user account.

**Request Body:**

```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "role": "student" | "teacher"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "UserID": 1,
      "Username": "string",
      "Email": "string",
      "Role": "student",
      "FirstName": "string",
      "LastName": "string"
    },
    "token": "jwt_token"
  }
}
```

#### POST /auth/login

Authenticate user login.

**Request Body:**

```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "UserID": 1,
      "Username": "string",
      "Email": "string",
      "Role": "student",
      "FirstName": "string",
      "LastName": "string"
    },
    "token": "jwt_token"
  }
}
```

#### POST /auth/verify-otp

Verify OTP for email verification.

**Request Body:**

```json
{
  "email": "string",
  "otp": "string"
}
```

### Quiz Management

#### POST /quizzes/create

Create a new quiz manually (Teacher only).

**Request Body:**

```json
{
  "title": "string",
  "description": "string",
  "difficulty": "easy" | "medium" | "hard",
  "subject": "string",
  "timeLimit": 30,
  "questions": [
    {
      "questionText": "string",
      "questionType": "multiple_choice",
      "points": 1,
      "options": [
        { "text": "string", "isCorrect": true },
        { "text": "string", "isCorrect": false }
      ]
    }
  ]
}
```

#### POST /quizzes/generate-ai

Generate quiz using AI from uploaded files (Teacher only).

**Request Body:**

```json
{
  "fileIds": [1, 2, 3],
  "title": "string",
  "description": "string",
  "difficulty": "easy" | "medium" | "hard",
  "subject": "string",
  "timeLimit": 30,
  "numQuestions": 10
}
```

#### GET /quizzes

Get all quizzes (Students see published, Teachers see their own).

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "QuizID": 1,
      "Title": "string",
      "Description": "string",
      "Difficulty": "medium",
      "Subject": "string",
      "TimeLimit": 30,
      "TotalQuestions": 10,
      "IsPublished": false,
      "CreatedAt": "2024-01-01T00:00:00.000Z",
      "Creator": {
        "UserID": 1,
        "Username": "string",
        "FirstName": "string",
        "LastName": "string"
      },
      "_count": {
        "Questions": 10
      }
    }
  ]
}
```

#### GET /quizzes/:quizId

Get quiz details with questions and options.

**Response:**

```json
{
  "success": true,
  "data": {
    "QuizID": 1,
    "Title": "string",
    "Description": "string",
    "Difficulty": "medium",
    "Subject": "string",
    "TimeLimit": 30,
    "TotalQuestions": 10,
    "Creator": {
      "UserID": 1,
      "Username": "string"
    },
    "Questions": [
      {
        "QuestionID": 1,
        "QuestionText": "string",
        "QuestionType": "multiple_choice",
        "Points": 1,
        "OrderIndex": 0,
        "Options": [
          {
            "OptionID": 1,
            "OptionText": "string",
            "OrderIndex": 0
          }
        ]
      }
    ]
  }
}
```

#### POST /quizzes/publish

Publish quiz to groups (Teacher only).

**Request Body:**

```json
{
  "QuizID": 1,
  "GroupIDs": [1, 2],
  "scheduledAt": "2024-01-01T10:00:00.000Z", // Optional for scheduling
  "isScheduled": true // Optional
}
```

### Quiz Responses

#### POST /quiz-responses/submit

Submit quiz response (Student only).

**Request Body:**

```json
{
  "quizId": 1,
  "answers": [
    {
      "questionId": 1,
      "selectedOptionId": 1,
      "timeTaken": 30
    }
  ],
  "timeSpent": 600
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quiz submitted successfully",
  "data": {
    "responseId": 1,
    "score": 8,
    "totalScore": 10,
    "percentage": "80.00",
    "timeSpent": 600,
    "status": "completed"
  }
}
```

cc

### Group Management

#### POST /groups/create

Create a new group (Teacher only).

**Request Body:**

```json
{
  "name": "string",
  "description": "string"
}
```

#### GET /groups/my-groups

Get groups created by the teacher.

#### POST /groups/:groupId/invite

Invite users to a group (Teacher only).

**Request Body:**

```json
{
  "emails": ["student@example.com"]
}
```

### File Management

#### POST /files/upload

Upload a file for processing (Teacher only).

**Request Body:** FormData with file

#### GET /files/my-files

Get files uploaded by the user.

## Error Handling

All API responses follow this structure:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message" // Only in development
}
```

Common HTTP status codes:

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Frontend Integration Examples

### React Component for Leaderboard

```javascript
import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const QuizLeaderboard = ({ quizId }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Fetch initial leaderboard
    fetchLeaderboard();

    // Setup socket connection
    const newSocket = io("http://localhost:5000", {
      auth: { token: localStorage.getItem("token") },
    });

    newSocket.emit("authenticate", userId);
    newSocket.emit("joinQuizRoom", quizId);

    newSocket.on("leaderboardUpdate", (data) => {
      if (data.type === "newSubmission") {
        // Update leaderboard with new submission
        setLeaderboard((prev) => {
          const updated = [...prev, data.data];
          return updated.sort((a, b) => b.score - a.score);
        });
      }
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [quizId]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`/api/leaderboard/quiz/${quizId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      setLeaderboard(data.data.leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  };

  return (
    <div className="leaderboard">
      <h2>Quiz Leaderboard</h2>
      {leaderboard.map((entry, index) => (
        <div key={entry.userId} className="leaderboard-entry">
          <span className="rank">#{entry.rank}</span>
          <span className="name">{entry.fullName}</span>
          <span className="score">
            {entry.score}/{entry.totalScore}
          </span>
          <span className="percentage">{entry.percentage}%</span>
        </div>
      ))}
    </div>
  );
};
```

### Teacher Dashboard with Real-time Updates

```javascript
const TeacherDashboard = () => {
  const [recentSubmissions, setRecentSubmissions] = useState([]);

  useEffect(() => {
    fetchRecentSubmissions();

    const socket = io("http://localhost:5000", {
      auth: { token: localStorage.getItem("token") },
    });

    socket.emit("authenticate", userId);
    socket.emit("joinTeacherRoom");

    socket.on("submissionNotification", (data) => {
      // Add new submission to the list
      setRecentSubmissions((prev) => [data, ...prev.slice(0, 9)]);
      // Show notification to teacher
      showNotification(`New submission received for quiz!`);
    });

    return () => socket.disconnect();
  }, []);

  const fetchRecentSubmissions = async () => {
    const response = await fetch(
      "/api/leaderboard/recent-submissions?limit=10",
      {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      },
    );
    const data = await response.json();
    setRecentSubmissions(data.data);
  };

  return (
    <div className="dashboard">
      <h1>Teacher Dashboard</h1>
      <div className="recent-submissions">
        <h3>Recent Submissions</h3>
        {recentSubmissions.map((submission) => (
          <div key={submission.submissionId} className="submission-card">
            <p>
              {submission.fullName} submitted {submission.quizTitle}
            </p>
            <p>
              Score: {submission.score}/{submission.totalScore} (
              {submission.percentage}%)
            </p>
            <small>{new Date(submission.completedAt).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Best Practices

1. **Error Handling**: Always check the `success` field in API responses
2. **Authentication**: Include JWT tokens in all authenticated requests
3. **Real-time Updates**: Use Socket.IO for live dashboard updates
4. **File Uploads**: Use FormData for file uploads
5. **Validation**: Validate all input data on both frontend and backend
6. **Loading States**: Show loading indicators during API calls
7. **Offline Handling**: Implement proper error handling for network issues

## Environment Variables

Make sure to set these environment variables in your frontend:

```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```
