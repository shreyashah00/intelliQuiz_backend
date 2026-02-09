# Scheduled Quiz Publishing & Question Bank Features

## Overview

This document describes the newly implemented features for scheduled quiz publishing and question bank management in the IntelliQuiz backend system.

## Features Implemented

### 1. Scheduled Quiz Publishing

#### Description

Teachers can now schedule quizzes to be automatically published to groups at a specific future date and time, instead of publishing immediately.

#### Database Changes

- Updated `QuizGroup` model with new fields:
  - `IsScheduled`: Boolean flag indicating if publishing is scheduled
  - `ScheduledAt`: DateTime for when the quiz should be published
  - `Status`: Enum ('scheduled', 'published', 'cancelled')
  - `PublishedAt`: DateTime when quiz was actually published
  - `CreatedAt`: DateTime when the schedule was created

#### API Endpoints

##### Schedule Quiz Publishing

```
POST /api/quizzes/publish-to-groups
```

**Request Body:**

```json
{
  "QuizID": 123,
  "GroupIDs": [1, 2, 3],
  "isScheduled": true,
  "scheduledAt": "2026-02-07T10:00:00Z"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quiz scheduled for publishing to 3 group(s) at 2/7/2026, 10:00:00 AM",
  "data": {
    "quizId": 123,
    "scheduledToGroups": 3,
    "scheduledAt": "2026-02-07T10:00:00Z",
    "groupNames": ["Class A", "Class B", "Class C"]
  }
}
```

##### Get Scheduled Quizzes

```
GET /api/quizzes/scheduled
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "QuizGroupID": 1,
      "QuizID": 123,
      "GroupID": 1,
      "IsScheduled": true,
      "ScheduledAt": "2026-02-07T10:00:00Z",
      "Status": "scheduled",
      "Quiz": {
        "QuizID": 123,
        "Title": "Mathematics Quiz 1",
        "Subject": "Mathematics",
        "Difficulty": "medium"
      },
      "Group": {
        "GroupID": 1,
        "Name": "Class A",
        "Description": "Advanced Mathematics",
        "memberCount": 25
      }
    }
  ]
}
```

##### Cancel Scheduled Publishing

```
DELETE /api/quizzes/:quizId/groups/:groupId/scheduled
```

**Response:**

```json
{
  "success": true,
  "message": "Scheduled publishing cancelled successfully"
}
```

#### Background Service

- **ScheduledPublishingService**: Runs every minute to check for quizzes that need to be published
- Automatically publishes quizzes when `ScheduledAt` time is reached
- Updates quiz status and sends notifications (framework ready for email notifications)

### 2. Question Bank Feature

#### Description

Teachers can now view all questions they've created across all their quizzes, with filtering and search capabilities.

#### API Endpoint

##### Get Question Bank

```
GET /api/quizzes/questions/bank?page=1&limit=20&subject=Math&difficulty=medium&questionType=multiple_choice&search=algebra
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `subject`: Filter by quiz subject
- `difficulty`: Filter by quiz difficulty
- `questionType`: Filter by question type ('multiple_choice', 'true_false', 'short_answer')
- `search`: Search in question text (case-insensitive)

**Response:**

```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "questionId": 1,
        "questionText": "What is 2 + 2?",
        "questionType": "multiple_choice",
        "points": 1,
        "orderIndex": 0,
        "usageCount": 45,
        "createdAt": "2026-02-06T08:00:00Z",
        "quiz": {
          "quizId": 123,
          "title": "Mathematics Quiz 1",
          "subject": "Mathematics",
          "difficulty": "easy",
          "createdAt": "2026-02-06T08:00:00Z"
        },
        "options": [
          {
            "optionId": 1,
            "text": "3",
            "isCorrect": false,
            "orderIndex": 0
          },
          {
            "optionId": 2,
            "text": "4",
            "isCorrect": true,
            "orderIndex": 1
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    },
    "stats": {
      "questionTypes": [
        {
          "QuestionType": "multiple_choice",
          "_count": {
            "QuestionID": 120
          }
        },
        {
          "QuestionType": "true_false",
          "_count": {
            "QuestionID": 30
          }
        }
      ],
      "subjects": [
        {
          "Subject": "Mathematics",
          "_count": {
            "QuizID": 5
          }
        },
        {
          "Subject": "Science",
          "_count": {
            "QuizID": 3
          }
        }
      ]
    }
  }
}
```

## Technical Implementation

### Dependencies Added

- `node-cron`: For scheduled task execution

### Files Modified/Created

1. **Database Schema** (`prisma/schema.prisma`)
   - Updated QuizGroup model with scheduling fields

2. **Services** (`src/services/scheduledPublishingService.js`)
   - New service for handling scheduled publishing logic

3. **Controllers** (`src/controllers/quizController.js`)
   - Updated `publishQuizToGroups` to support scheduling
   - Added `getScheduledQuizzes`, `cancelScheduledPublishing`, `getQuestionBank`

4. **Routes** (`src/routes/quizRoutes.js`)
   - Added new endpoints for scheduled publishing and question bank

5. **Application** (`src/app.js`)
   - Initialize scheduled publishing service on startup

### Database Migration

Run the following command to apply schema changes:

```bash
npx prisma migrate dev --name add_scheduled_publishing
```

### Service Lifecycle

- **Startup**: Scheduled publishing service starts automatically when the server starts
- **Execution**: Runs every minute to check for due quizzes
- **Shutdown**: Gracefully stops when server shuts down

## Usage Examples

### Scheduling a Quiz

```javascript
// Schedule a quiz for tomorrow at 9 AM
const response = await fetch("/api/quizzes/publish-to-groups", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    QuizID: 123,
    GroupIDs: [1, 2],
    isScheduled: true,
    scheduledAt: "2026-02-07T09:00:00Z",
  }),
});
```

### Getting Question Bank

```javascript
// Get first page of math questions
const response = await fetch(
  "/api/quizzes/questions/bank?subject=Mathematics&page=1&limit=10",
);
const data = await response.json();
```

### Managing Scheduled Quizzes

```javascript
// Get all scheduled quizzes
const scheduled = await fetch("/api/quizzes/scheduled");

// Cancel a scheduled quiz
await fetch("/api/quizzes/123/groups/1/scheduled", { method: "DELETE" });
```

## Security Considerations

- All endpoints require authentication
- Teachers can only manage their own quizzes and groups
- Scheduled publishing validates future dates
- Question bank only shows questions from teacher's own quizzes

## Future Enhancements

- Email notifications when quizzes are auto-published
- Bulk scheduling operations
- Question bank export/import functionality
- Question usage analytics and statistics
