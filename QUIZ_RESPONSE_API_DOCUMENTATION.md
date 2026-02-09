# Quiz Response API Documentation

## Overview

The Quiz Response API provides comprehensive functionality for submitting quiz responses, tracking performance, and generating AI-powered insights. This module handles the complete quiz-taking workflow from submission to personalized feedback.

### Base URL

```
http://localhost:5000/api/quiz-responses
```

### Authentication

All endpoints require authentication. Include JWT token in headers:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## Endpoints

### 1. Submit Quiz Response

**Endpoint:** `POST /submit`

**Description:** Submit a completed quiz with all answers. Automatically calculates score and grades responses.

**Access:** Student (authenticated)

**Request Body:**

```json
{
  "quizId": 1,
  "timeSpent": 300,
  "answers": [
    {
      "questionId": 1,
      "selectedOptionId": 3,
      "timeTaken": 45
    },
    {
      "questionId": 2,
      "selectedOptionId": 7,
      "timeTaken": 60
    },
    {
      "questionId": 3,
      "answerText": "JavaScript is a programming language",
      "timeTaken": 120
    }
  ]
}
```

**Request Body Schema:**

```typescript
interface SubmitQuizRequest {
  quizId: number; // Required: ID of the quiz being submitted
  timeSpent?: number; // Optional: Total time spent in seconds
  answers: Answer[]; // Required: Array of answers
}

interface Answer {
  questionId: number; // Required: Question ID
  selectedOptionId?: number; // Optional: For multiple choice questions
  answerText?: string; // Optional: For short answer questions
  timeTaken?: number; // Optional: Time spent on this question in seconds
}
```

**Response (Success - 201):**

```json
{
  "success": true,
  "message": "Quiz submitted successfully",
  "data": {
    "responseId": 1,
    "score": 8,
    "totalScore": 10,
    "percentage": "80.00",
    "timeSpent": 300,
    "status": "completed"
  }
}
```

**Response Schema:**

```typescript
interface SubmitQuizResponse {
  success: boolean;
  message: string;
  data: {
    responseId: number;
    score: number;
    totalScore: number;
    percentage: string;
    timeSpent: number;
    status: string;
  };
}
```

**Error Responses:**

**400 Bad Request:**

```json
{
  "success": false,
  "message": "Quiz ID and answers are required"
}
```

**403 Forbidden:**

```json
{
  "success": false,
  "message": "Quiz is not published"
}
```

**404 Not Found:**

```json
{
  "success": false,
  "message": "Quiz not found"
}
```

---

### 2. Get User's Quiz Responses

**Endpoint:** `GET /my-responses`

**Description:** Get all quiz responses for the authenticated user with pagination.

**Access:** Authenticated user

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `quizId` (optional): Filter by specific quiz
- `status` (optional): Filter by status ('completed', 'in_progress', 'abandoned')

**Example Requests:**

```
GET /api/quiz-responses/my-responses
GET /api/quiz-responses/my-responses?page=1&limit=10&status=completed
GET /api/quiz-responses/my-responses?quizId=1
```

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "responses": [
      {
        "ResponseID": 1,
        "QuizID": 1,
        "UserID": 5,
        "Score": 8,
        "TotalScore": 10,
        "Percentage": 80,
        "TimeSpent": 300,
        "Status": "completed",
        "CompletedAt": "2026-02-05T12:30:00.000Z",
        "AIInsightsGenerated": true,
        "Quiz": {
          "QuizID": 1,
          "Title": "JavaScript Fundamentals",
          "Description": "Test your JS knowledge",
          "Difficulty": "medium",
          "Subject": "Programming",
          "TotalQuestions": 10
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

**Response Schema:**

```typescript
interface UserResponsesResponse {
  success: boolean;
  data: {
    responses: QuizResponseSummary[];
    pagination: PaginationInfo;
  };
}

interface QuizResponseSummary {
  ResponseID: number;
  QuizID: number;
  UserID: number;
  Score: number;
  TotalScore: number;
  Percentage: number;
  TimeSpent: number | null;
  Status: string;
  CompletedAt: string;
  AIInsightsGenerated: boolean;
  Quiz: {
    QuizID: number;
    Title: string;
    Description: string | null;
    Difficulty: string;
    Subject: string | null;
    TotalQuestions: number;
  };
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

### 3. Get Specific Quiz Response

**Endpoint:** `GET /:responseId`

**Description:** Get detailed information about a specific quiz response including all answers.

**Access:** Owner or Teacher

**URL Parameters:**

- `responseId`: ID of the quiz response

**Example:** `GET /api/quiz-responses/1`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "ResponseID": 1,
    "QuizID": 1,
    "UserID": 5,
    "Score": 8,
    "TotalScore": 10,
    "Percentage": 80,
    "TimeSpent": 300,
    "Status": "completed",
    "StartedAt": "2026-02-05T12:25:00.000Z",
    "CompletedAt": "2026-02-05T12:30:00.000Z",
    "AIInsightsGenerated": true,
    "AIInsights": {
      "overallPerformance": {
        "grade": "B",
        "summary": "Good performance with room for improvement in advanced concepts.",
        "strengths": ["Strong understanding of basic syntax"],
        "weaknesses": ["Needs practice with asynchronous programming"]
      }
    },
    "Quiz": {
      "QuizID": 1,
      "Title": "JavaScript Fundamentals",
      "Difficulty": "medium",
      "Creator": {
        "UserID": 2,
        "Username": "teacher1",
        "FirstName": "John",
        "LastName": "Doe"
      }
    },
    "User": {
      "UserID": 5,
      "Username": "student1",
      "FirstName": "Jane",
      "LastName": "Smith",
      "Email": "jane@example.com"
    },
    "Answers": [
      {
        "AnswerID": 1,
        "QuestionID": 1,
        "SelectedOptionID": 3,
        "IsCorrect": true,
        "PointsEarned": 1,
        "TimeTaken": 45,
        "Question": {
          "QuestionID": 1,
          "QuestionText": "What is JavaScript?",
          "QuestionType": "multiple_choice",
          "Points": 1,
          "Options": [
            {
              "OptionID": 1,
              "OptionText": "A coffee brand",
              "IsCorrect": false
            },
            {
              "OptionID": 3,
              "OptionText": "A programming language",
              "IsCorrect": true
            }
          ]
        },
        "SelectedOption": {
          "OptionID": 3,
          "OptionText": "A programming language",
          "IsCorrect": true
        }
      }
    ]
  }
}
```

**Response Schema:**

```typescript
interface QuizResponseDetails {
  ResponseID: number;
  QuizID: number;
  UserID: number;
  Score: number;
  TotalScore: number;
  Percentage: number;
  TimeSpent: number | null;
  Status: string;
  StartedAt: string;
  CompletedAt: string | null;
  AIInsightsGenerated: boolean;
  AIInsights: AIInsights | null;
  Quiz: QuizInfo;
  User: UserInfo;
  Answers: QuizAnswerDetail[];
}

interface QuizAnswerDetail {
  AnswerID: number;
  QuestionID: number;
  SelectedOptionID: number | null;
  AnswerText: string | null;
  IsCorrect: boolean;
  PointsEarned: number;
  TimeTaken: number | null;
  Question: QuestionDetail;
  SelectedOption: OptionDetail | null;
}
```

---

### 4. Generate AI Insights

**Endpoint:** `POST /:responseId/generate-insights`

**Description:** Generate AI-powered personalized insights for a quiz response.

**Access:** Owner or Teacher

**URL Parameters:**

- `responseId`: ID of the quiz response

**Request Body:** None required

**Example:** `POST /api/quiz-responses/1/generate-insights`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "AI insights generated successfully",
  "data": {
    "overallPerformance": {
      "grade": "B",
      "summary": "Good performance with room for improvement in advanced concepts.",
      "strengths": [
        "Strong understanding of basic syntax",
        "Good problem-solving approach"
      ],
      "weaknesses": [
        "Needs practice with asynchronous programming",
        "Array methods require more attention"
      ]
    },
    "detailedAnalysis": {
      "conceptualUnderstanding": "Demonstrates solid grasp of fundamental concepts",
      "timeManagement": "Good pacing, completed quiz within time limit",
      "accuracyPattern": "80% accuracy rate with consistent performance"
    },
    "improvableAreas": [
      {
        "area": "Asynchronous Programming",
        "description": "Struggles with promises and async/await",
        "priority": "high",
        "recommendations": [
          "Practice with promise chains",
          "Study async/await patterns",
          "Work on error handling in async code"
        ]
      }
    ],
    "strengths": [
      {
        "area": "Basic Syntax",
        "description": "Excellent command of JavaScript syntax",
        "encouragement": "Your foundation is strong - build on it!"
      }
    ],
    "recommendations": [
      "Focus on asynchronous programming concepts",
      "Practice more array manipulation problems",
      "Review closure and scope concepts"
    ],
    "nextSteps": [
      "Complete practice exercises on async/await",
      "Review async programming documentation",
      "Attempt advanced difficulty quizzes"
    ],
    "motivationalMessage": "Great effort! Your fundamentals are solid. Focus on the areas highlighted and you'll see significant improvement.",
    "metadata": {
      "generatedAt": "2026-02-05T12:35:00.000Z",
      "quizScore": 8,
      "quizTotalScore": 10,
      "percentage": 80,
      "correctAnswers": 8,
      "totalQuestions": 10,
      "difficulty": "medium"
    },
    "questionBreakdown": [
      {
        "questionNumber": 1,
        "isCorrect": true,
        "timeTaken": 45,
        "needsReview": false
      },
      {
        "questionNumber": 2,
        "isCorrect": false,
        "timeTaken": 120,
        "needsReview": true
      }
    ]
  }
}
```

**AI Insights Schema:**

```typescript
interface AIInsights {
  overallPerformance: {
    grade: string; // A, B, C, D, F
    summary: string;
    strengths: string[];
    weaknesses: string[];
  };
  detailedAnalysis: {
    conceptualUnderstanding: string;
    timeManagement: string;
    accuracyPattern: string;
  };
  improvableAreas: ImprovableArea[];
  strengths: StrengthArea[];
  recommendations: string[];
  nextSteps: string[];
  motivationalMessage: string;
  metadata: {
    generatedAt: string;
    quizScore: number;
    quizTotalScore: number;
    percentage: number;
    correctAnswers: number;
    totalQuestions: number;
    difficulty: string;
  };
  questionBreakdown: QuestionBreakdown[];
}

interface ImprovableArea {
  area: string;
  description: string;
  priority: "high" | "medium" | "low";
  recommendations: string[];
}

interface StrengthArea {
  area: string;
  description: string;
  encouragement: string;
}

interface QuestionBreakdown {
  questionNumber: number;
  isCorrect: boolean;
  timeTaken: number;
  needsReview: boolean;
}
```

---

### 5. Get AI Insights

**Endpoint:** `GET /:responseId/insights`

**Description:** Retrieve previously generated AI insights for a quiz response.

**Access:** Owner or Teacher

**URL Parameters:**

- `responseId`: ID of the quiz response

**Example:** `GET /api/quiz-responses/1/insights`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    // Same structure as Generate AI Insights response
  }
}
```

**Response (Not Found - 404):**

```json
{
  "success": false,
  "message": "AI insights not generated yet. Please generate insights first."
}
```

---

### 6. Get User Analytics

**Endpoint:** `GET /my-analytics`

**Description:** Get comprehensive performance analytics for the authenticated user.

**Access:** Authenticated user

**Example:** `GET /api/quiz-responses/my-analytics`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "totalQuizzes": 15,
    "averageScore": "7.80",
    "averagePercentage": "78.00",
    "strongSubjects": [
      {
        "subject": "JavaScript",
        "averagePercentage": 85.5,
        "quizzesTaken": 5
      },
      {
        "subject": "HTML",
        "averagePercentage": 82.3,
        "quizzesTaken": 3
      }
    ],
    "weakSubjects": [
      {
        "subject": "CSS",
        "averagePercentage": 65.2,
        "quizzesTaken": 4
      }
    ],
    "performanceByDifficulty": {
      "easy": {
        "count": 5,
        "averagePercentage": 90.5
      },
      "medium": {
        "count": 7,
        "averagePercentage": 75.3
      },
      "hard": {
        "count": 3,
        "averagePercentage": 62.1
      }
    },
    "recentPerformance": [
      {
        "quizTitle": "JavaScript Fundamentals",
        "percentage": 80,
        "completedAt": "2026-02-05T12:30:00.000Z"
      }
    ]
  }
}
```

**Analytics Schema:**

```typescript
interface UserAnalytics {
  totalQuizzes: number;
  averageScore: string;
  averagePercentage: string;
  strongSubjects: SubjectPerformance[];
  weakSubjects: SubjectPerformance[];
  performanceByDifficulty: {
    [key: string]: {
      count: number;
      averagePercentage: number;
    };
  };
  recentPerformance: RecentQuiz[];
}

interface SubjectPerformance {
  subject: string;
  averagePercentage: number;
  quizzesTaken: number;
}

interface RecentQuiz {
  quizTitle: string;
  percentage: number;
  completedAt: string;
}
```

---

### 7. Get Quiz Responses (Teacher)

**Endpoint:** `GET /quiz/:quizId`

**Description:** Get all responses for a specific quiz with statistics. Teacher only, must own the quiz.

**Access:** Teacher (quiz creator)

**URL Parameters:**

- `quizId`: ID of the quiz

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Example:** `GET /api/quiz-responses/quiz/1?page=1&limit=10`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "responses": [
      {
        "ResponseID": 1,
        "QuizID": 1,
        "Score": 8,
        "TotalScore": 10,
        "Percentage": 80,
        "TimeSpent": 300,
        "Status": "completed",
        "CompletedAt": "2026-02-05T12:30:00.000Z",
        "User": {
          "UserID": 5,
          "Username": "student1",
          "FirstName": "Jane",
          "LastName": "Smith",
          "Email": "jane@example.com"
        },
        "Answers": [
          {
            "IsCorrect": true,
            "PointsEarned": 1
          }
        ]
      }
    ],
    "stats": {
      "totalResponses": 25,
      "averageScore": 7.5,
      "averagePercentage": 75,
      "highestScore": 10,
      "lowestScore": 3
    },
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

---

### 8. Delete Quiz Response

**Endpoint:** `DELETE /:responseId`

**Description:** Delete a quiz response. Students can delete their own, teachers can delete any for their quizzes.

**Access:** Owner or Quiz Creator (Teacher)

**URL Parameters:**

- `responseId`: ID of the quiz response

**Example:** `DELETE /api/quiz-responses/1`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Quiz response deleted successfully"
}
```

---

## Error Responses

### Common Error Codes

**400 Bad Request**

```json
{
  "success": false,
  "message": "Quiz ID and answers are required"
}
```

**401 Unauthorized**

```json
{
  "success": false,
  "message": "Authentication required"
}
```

**403 Forbidden**

```json
{
  "success": false,
  "message": "Not authorized to view this response"
}
```

**404 Not Found**

```json
{
  "success": false,
  "message": "Quiz response not found"
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "message": "Failed to submit quiz",
  "error": "Error details"
}
```

---

## Data Models

### QuizResponse

```typescript
interface QuizResponse {
  ResponseID: number;
  QuizID: number;
  UserID: number;
  Score: number;
  TotalScore: number;
  Percentage: number;
  TimeSpent: number | null; // seconds
  Status: "completed" | "in_progress" | "abandoned";
  StartedAt: string;
  CompletedAt: string | null;
  AIInsightsGenerated: boolean;
  AIInsights: AIInsights | null;
  CreatedAt: string;
  UpdatedAt: string;
}
```

### QuizAnswer

```typescript
interface QuizAnswer {
  AnswerID: number;
  ResponseID: number;
  QuestionID: number;
  SelectedOptionID: number | null; // For multiple choice
  AnswerText: string | null; // For short answer
  IsCorrect: boolean;
  PointsEarned: number;
  TimeTaken: number | null; // seconds
  CreatedAt: string;
}
```

---

## Rate Limiting & Best Practices

### Recommendations

1. **AI Insights Generation**
   - Limit to once per response initially
   - Can regenerate if needed
   - Takes 2-5 seconds typically

2. **Pagination**
   - Use pagination for large result sets
   - Recommended limit: 10-20 items per page

3. **Caching**
   - Cache quiz responses on client
   - Cache analytics data (5 min stale time)
   - Cache insights once generated

4. **Error Handling**
   - Always validate quiz exists and is published
   - Check user authentication
   - Handle network errors gracefully

---

## Testing Examples

### Submit Quiz Response

```bash
curl -X POST http://localhost:5000/api/quiz-responses/submit \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quizId": 1,
    "timeSpent": 300,
    "answers": [
      {"questionId": 1, "selectedOptionId": 3, "timeTaken": 45},
      {"questionId": 2, "selectedOptionId": 7, "timeTaken": 60}
    ]
  }'
```

### Generate AI Insights

```bash
curl -X POST http://localhost:5000/api/quiz-responses/1/generate-insights \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get User Analytics

```bash
curl http://localhost:5000/api/quiz-responses/my-analytics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Change Log

**v1.0.0 - February 5, 2026**

- Initial release of Quiz Response API
- Quiz submission with automatic grading
- AI-powered insights generation
- User analytics dashboard
- Teacher response management
- Comprehensive error handling
