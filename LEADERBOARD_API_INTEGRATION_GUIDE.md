# Leaderboard API Integration Guide

This guide provides detailed documentation for integrating with the Leaderboard API endpoints. All endpoints require authentication via JWT token in the Authorization header.

## Authentication

All leaderboard endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### 1. Get Quiz Leaderboard

**Endpoint:** `GET /api/leaderboard/quiz/:quizId`

**Description:** Retrieves the leaderboard for a specific quiz, showing top performers based on scores.

**Path Parameters:**

- `quizId` (string): The unique identifier of the quiz

**Response Body:**

```json
{
  "success": true,
  "data": {
    "quiz": {
      "quizId": 123,
      "title": "Mathematics Quiz 1",
      "subject": "Mathematics",
      "difficulty": "Medium",
      "totalQuestions": 10,
      "timeLimit": 30
    },
    "leaderboard": [
      {
        "rank": 1,
        "userId": "uuid-1",
        "username": "student1",
        "fullName": "John Doe",
        "email": "john@example.com",
        "profilePicture": null,
        "score": 95,
        "totalScore": 100,
        "percentage": 95.0,
        "timeSpent": 450000,
        "completedAt": "2024-01-15T10:30:00.000Z",
        "aiInsightsGenerated": false
      }
    ],
    "statistics": {
      "totalSubmissions": 25,
      "averageScore": 82.5,
      "highestScore": 95,
      "lowestScore": 45,
      "completionRate": 100
    }
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: Quiz not found
- `500 Internal Server Error`: Server error

### 2. Get Group Leaderboard

**Endpoint:** `GET /api/leaderboard/group/:groupId`

**Description:** Retrieves the leaderboard for a specific group, showing aggregated performance across all quizzes in the group.

**Path Parameters:**

- `groupId` (string): The unique identifier of the group

**Response Body:**

```json
{
  "success": true,
  "data": {
    "group": {
      "groupId": 456,
      "name": "Class A Mathematics",
      "description": "Advanced mathematics group"
    },
    "leaderboard": [
      {
        "rank": 1,
        "userId": "uuid-1",
        "username": "student1",
        "fullName": "John Doe",
        "email": "john@example.com",
        "profilePicture": null,
        "totalScore": 475,
        "totalPossible": 500,
        "averagePercentage": 95.0,
        "quizzesCompleted": 5,
        "quizDetails": [
          {
            "quizId": 123,
            "quizTitle": "Algebra Quiz",
            "score": 95,
            "totalScore": 100,
            "percentage": 95.0,
            "completedAt": "2024-01-15T10:30:00.000Z"
          }
        ]
      }
    ],
    "quizStats": [
      {
        "quizId": 123,
        "title": "Algebra Quiz",
        "subject": "Mathematics",
        "difficulty": "Medium",
        "totalQuestions": 10,
        "submissions": 25,
        "averageScore": 82.5
      }
    ],
    "statistics": {
      "totalQuizzes": 5,
      "totalSubmissions": 125,
      "averageScore": 87.3
    }
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing JWT token
- `404 Not Found`: Group not found
- `500 Internal Server Error`: Server error

### 3. Get Recent Submissions

**Endpoint:** `GET /api/leaderboard/recent`

**Description:** Retrieves the most recent quiz submissions across all quizzes the user has access to.

**Query Parameters:**

- `limit` (optional, number): Number of recent submissions to return (default: 10, max: 50)

**Response Body:**

```json
{
  "success": true,
  "data": [
    {
      "submissionId": 789,
      "quizId": 123,
      "quizTitle": "Mathematics Quiz 1",
      "quizSubject": "Mathematics",
      "userId": "uuid-1",
      "username": "student1",
      "fullName": "John Doe",
      "email": "john@example.com",
      "score": 90,
      "totalScore": 100,
      "percentage": 90.0,
      "timeSpent": 420000,
      "completedAt": "2024-01-15T14:25:00.000Z",
      "aiInsightsGenerated": false
    }
  ]
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing JWT token
- `400 Bad Request`: Invalid limit parameter
- `500 Internal Server Error`: Server error

## Real-time Updates with Socket.IO

The leaderboard system supports real-time updates through Socket.IO. Connect to the server and listen for submission events.

### Socket.IO Connection

**Connection URL:** `ws://localhost:5000` (or your server URL)

**Authentication:** After connecting, authenticate with your user ID:

```javascript
const socket = io("http://localhost:5000");

// After connection
socket.on("connect", () => {
  socket.emit("authenticate", userId); // Send your user ID
});
```

### Events

#### Listen for Submission Notifications

**Event:** `submissionNotification`

**Description:** Emitted to all teachers when any student submits a quiz. Provides basic submission information for notifications.

**Event Data:**

```json
{
  "quizId": 123,
  "userId": "uuid-1",
  "score": 85,
  "totalScore": 100,
  "percentage": 85.0,
  "submittedAt": "2024-01-15T15:00:00.000Z"
}
```

#### Listen for Leaderboard Updates

**Event:** `leaderboardUpdate`

**Description:** Emitted to users in a specific quiz room when a new submission is made. Contains detailed submission data for real-time leaderboard updates.

**Event Data:**

```json
{
  "type": "newSubmission",
  "data": {
    "userId": "uuid-1",
    "username": "student1",
    "fullName": "John Doe",
    "score": 85,
    "totalScore": 100,
    "percentage": 85.0,
    "submittedAt": "2024-01-15T15:00:00.000Z"
  }
}
```

### Joining Rooms

To receive real-time updates, clients need to join appropriate rooms:

**Join Quiz Room** (for quiz-specific leaderboard updates):

```javascript
socket.emit("joinQuizRoom", quizId);
```

**Join Teacher Room** (for all submission notifications):

```javascript
socket.emit("joinTeacherRoom");
```

### Socket.IO Error Handling

**Connection Errors:**

- `connect_error`: Authentication failed or server unreachable
- `disconnect`: Connection lost

**Example Error Handling:**

```javascript
socket.on("connect_error", (error) => {
  console.error("Socket connection failed:", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
});
```

## Rate Limiting

- All endpoints are rate limited to prevent abuse
- Standard limits: 100 requests per minute per user
- Exceeding limits returns `429 Too Many Requests`

## Data Types

### Score Calculation

- Scores are calculated as: `(correctAnswers / totalQuestions) * 100`
- Rounded to 1 decimal place

### Time Format

- `completionTime`: Time in milliseconds
- `submittedAt`: ISO 8601 timestamp string

### Ranking

- Rankings are calculated based on score (descending)
- Ties are broken by completion time (ascending)
- Real-time updates maintain accurate rankings
