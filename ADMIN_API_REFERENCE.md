# Admin API Reference

## User Management

### Get All Users

**GET** `/api/admin/users`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "UserID": 1,
      "Username": "string",
      "Email": "string",
      "Role": "student|teacher|admin",
      "FirstName": "string",
      "LastName": "string",
      "PhoneNumber": "string",
      "ProfilePicture": "string",
      "Bio": "string",
      "EmailVerified": true,
      "AccountStatus": "active|inactive|suspended",
      "CreatedAt": "2026-02-13T00:00:00.000Z",
      "UpdatedAt": "2026-02-13T00:00:00.000Z",
      "LastLogin": "2026-02-13T00:00:00.000Z",
      "_count": {
        "CreatedQuizzes": 0,
        "QuizResponses": 0,
        "Files": 0
      }
    }
  ]
}
```

### Update User Account Status

**PUT** `/api/admin/users/:userId/status`

**Request Body:**

```json
{
  "accountStatus": "active|inactive|suspended"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User account active|inactive|suspended",
  "data": {
    "UserID": 1,
    "Username": "string",
    "Email": "string",
    "Role": "student|teacher|admin",
    "AccountStatus": "active|inactive|suspended"
  }
}
```

### Update User Role

**PUT** `/api/admin/users/:userId/role`

**Request Body:**

```json
{
  "role": "student|teacher|admin"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User role updated to student|teacher|admin",
  "data": {
    "UserID": 1,
    "Username": "string",
    "Email": "string",
    "Role": "student|teacher|admin"
  }
}
```

### Create Admin User

**POST** `/api/admin/users`

**Request Body:**

```json
{
  "Username": "string",
  "Email": "string",
  "Password": "string",
  "FirstName": "string",
  "LastName": "string"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Admin user created successfully",
  "data": {
    "UserID": 1,
    "Username": "string",
    "Email": "string",
    "Role": "admin",
    "FirstName": "string",
    "LastName": "string",
    "CreatedAt": "2026-02-13T00:00:00.000Z"
  }
}
```

## System Monitoring

### Get System Statistics

**GET** `/api/admin/stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 100,
      "activeUsers": 95,
      "totalQuizzes": 50,
      "publishedQuizzes": 45,
      "totalQuizResponses": 200,
      "totalFiles": 30
    },
    "userRoles": {
      "student": 80,
      "teacher": 15,
      "admin": 5
    },
    "recentActivity": {
      "newUsers": 10,
      "newQuizzes": 5,
      "quizResponses": 25
    }
  }
}
```

## Content Oversight

### Get All Quizzes

**GET** `/api/admin/quizzes`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "QuizID": 1,
      "Title": "string",
      "Description": "string",
      "Difficulty": "easy|medium|hard",
      "Subject": "string",
      "TimeLimit": 30,
      "IsPublished": true,
      "CreatedAt": "2026-02-13T00:00:00.000Z",
      "UpdatedAt": "2026-02-13T00:00:00.000Z",
      "Creator": {
        "UserID": 1,
        "Username": "string",
        "FirstName": "string",
        "LastName": "string",
        "Role": "teacher"
      },
      "_count": {
        "Questions": 10,
        "QuizResponses": 25
      }
    }
  ]
}
```

### Get All Questions

**GET** `/api/admin/questions`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "QuestionID": 1,
      "QuizID": 1,
      "QuestionText": "string",
      "QuestionType": "multiple_choice|true_false|short_answer",
      "Points": 1,
      "OrderIndex": 1,
      "CreatedAt": "2026-02-13T00:00:00.000Z",
      "Quiz": {
        "QuizID": 1,
        "Title": "string",
        "IsPublished": true,
        "Creator": {
          "Username": "string",
          "FirstName": "string",
          "LastName": "string"
        }
      },
      "Options": [
        {
          "OptionID": 1,
          "OptionText": "string",
          "IsCorrect": true,
          "OrderIndex": 1
        }
      ],
      "_count": {
        "Answers": 25
      }
    }
  ]
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error description"
}
```

**Common HTTP Status Codes:**

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

**Authentication Required:** All admin endpoints require a valid JWT token in the Authorization header with Bearer prefix and admin role.
