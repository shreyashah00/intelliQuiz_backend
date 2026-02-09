# IntelliQuiz Group Management API Reference

## Overview

This document provides a comprehensive API reference for the Group Management feature in IntelliQuiz. This feature allows teachers to create groups, invite students, and publish quizzes to specific groups.

## Authentication

All API endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

**Role-Based Access:**

- **Teacher-only endpoints**: Create groups, manage students, publish quizzes
- **Student-only endpoints**: Accept/reject invitations, view published quizzes
- **All authenticated users**: View their groups and invitations

## Base URL

```
http://localhost:5000/api
```

---

## Group Management APIs

### 1. Create Group

**Endpoint:** `POST /groups`  
**Access:** Teachers only

**Request Body:**

```json
{
  "Name": "Computer Science 101",
  "Description": "Introduction to Computer Science fundamentals"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "GroupID": 1,
    "Name": "Computer Science 101",
    "Description": "Introduction to Computer Science fundamentals",
    "CreatedBy": 2,
    "CreatedAt": "2024-02-06T08:30:00.000Z",
    "UpdatedAt": "2024-02-06T08:30:00.000Z"
  }
}
```

### 2. Get Teacher's Groups

**Endpoint:** `GET /groups`  
**Access:** Teachers only

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "GroupID": 1,
      "Name": "Computer Science 101",
      "Description": "Introduction to Computer Science fundamentals",
      "CreatedAt": "2024-02-06T08:30:00.000Z",
      "UpdatedAt": "2024-02-06T08:30:00.000Z",
      "_count": {
        "Members": 5
      },
      "Members": [
        {
          "GroupMemberID": 1,
          "UserID": 3,
          "Status": "accepted",
          "InvitedAt": "2024-02-06T08:35:00.000Z",
          "AcceptedAt": "2024-02-06T08:40:00.000Z",
          "User": {
            "UserID": 3,
            "Username": "john_doe",
            "Email": "john@example.com",
            "FirstName": "John",
            "LastName": "Doe"
          }
        }
      ]
    }
  ]
}
```

### 3. Search Users

**Endpoint:** `GET /groups/search-users?query=<search_term>`  
**Access:** Teachers only

**Query Parameters:**

- `query`: Search term (minimum 2 characters)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "UserID": 3,
      "Username": "john_doe",
      "Email": "john@example.com",
      "FirstName": "John",
      "LastName": "Doe"
    },
    {
      "UserID": 4,
      "Username": "jane_smith",
      "Email": "jane@example.com",
      "FirstName": "Jane",
      "LastName": "Smith"
    }
  ]
}
```

### 4. Add Students to Group

**Endpoint:** `POST /groups/add-students`  
**Access:** Teachers only

**Request Body:**

```json
{
  "GroupID": 1,
  "StudentIDs": [3, 4, 5]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Successfully added 3 students to the group and sent invitation emails",
  "data": {
    "addedCount": 3,
    "invitedStudents": [
      {
        "UserID": 3,
        "Username": "john_doe",
        "Email": "john@example.com",
        "FirstName": "John",
        "LastName": "Doe"
      }
    ]
  }
}
```

### 5. Get Group Members

**Endpoint:** `GET /groups/:GroupID/members`  
**Access:** Group creator (teacher) only

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "GroupMemberID": 1,
      "UserID": 3,
      "Status": "accepted",
      "InvitedAt": "2024-02-06T08:35:00.000Z",
      "AcceptedAt": "2024-02-06T08:40:00.000Z",
      "User": {
        "UserID": 3,
        "Username": "john_doe",
        "Email": "john@example.com",
        "FirstName": "John",
        "LastName": "Doe"
      }
    }
  ]
}
```

### 6. Remove Student from Group

**Endpoint:** `DELETE /groups/:GroupID/students/:UserID`  
**Access:** Group creator (teacher) only

**Response:**

```json
{
  "success": true,
  "message": "Student removed from group successfully"
}
```

### 7. Delete Group

**Endpoint:** `DELETE /groups/:GroupID`  
**Access:** Group creator (teacher) only

**Response:**

```json
{
  "success": true,
  "message": "Group deleted successfully"
}
```

---

## Student Group APIs

### 8. Accept Group Invitation

**Endpoint:** `POST /user/groups/:GroupID/accept`  
**Access:** Authenticated students

**Response:**

```json
{
  "success": true,
  "message": "Successfully joined the group \"Computer Science 101\"",
  "data": {
    "group": {
      "GroupID": 1,
      "Name": "Computer Science 101",
      "Description": "Introduction to Computer Science fundamentals",
      "Creator": {
        "Username": "teacher_smith",
        "FirstName": "Dr.",
        "LastName": "Smith"
      }
    }
  }
}
```

### 9. Reject Group Invitation

**Endpoint:** `POST /user/groups/:GroupID/reject`  
**Access:** Authenticated students

**Response:**

```json
{
  "success": true,
  "message": "Rejected invitation to join the group \"Computer Science 101\""
}
```

### 10. Get User's Groups

**Endpoint:** `GET /user/groups`  
**Access:** Authenticated users

**Response:**

```json
{
  "success": true,
  "data": {
    "acceptedGroups": [
      {
        "GroupID": 1,
        "Name": "Computer Science 101",
        "Description": "Introduction to Computer Science fundamentals",
        "CreatedAt": "2024-02-06T08:30:00.000Z",
        "Creator": {
          "Username": "teacher_smith",
          "FirstName": "Dr.",
          "LastName": "Smith"
        },
        "joinedAt": "2024-02-06T08:40:00.000Z"
      }
    ],
    "pendingInvitations": [
      {
        "GroupID": 2,
        "Name": "Advanced Algorithms",
        "Description": "Advanced algorithm design and analysis",
        "CreatedAt": "2024-02-06T09:00:00.000Z",
        "Creator": {
          "Username": "prof_jones",
          "FirstName": "Prof.",
          "LastName": "Jones"
        },
        "invitedAt": "2024-02-06T09:05:00.000Z"
      }
    ]
  }
}
```

---

## Quiz Publishing APIs

### 11. Publish Quiz to Groups

**Endpoint:** `POST /quizzes/publish-to-groups`  
**Access:** Quiz creator (teacher) only

**Request Body:**

```json
{
  "QuizID": 1,
  "GroupIDs": [1, 2, 3]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quiz published to 3 group(s) successfully",
  "data": {
    "quizId": 1,
    "publishedToGroups": 3,
    "groupNames": ["Computer Science 101", "Data Structures", "Algorithms"]
  }
}
```

### 12. Get Published Quizzes for User

**Endpoint:** `GET /quizzes/published-for-user`  
**Access:** Authenticated students

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "QuizID": 1,
      "Title": "Introduction to Programming",
      "Description": "Basic programming concepts quiz",
      "Difficulty": "easy",
      "Subject": "Computer Science",
      "TimeLimit": 30,
      "TotalQuestions": 10,
      "CreatedAt": "2024-02-06T08:00:00.000Z",
      "Creator": {
        "Username": "teacher_smith",
        "FirstName": "Dr.",
        "LastName": "Smith"
      },
      "publishedToGroups": [
        {
          "GroupID": 1,
          "Name": "Computer Science 101"
        }
      ],
      "publishedAt": "2024-02-06T08:30:00.000Z"
    }
  ]
}
```

### 13. Get Groups a Quiz is Published To

**Endpoint:** `GET /quizzes/:QuizID/groups`  
**Access:** Quiz creator (teacher) only

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "GroupID": 1,
      "Name": "Computer Science 101",
      "Description": "Introduction to Computer Science fundamentals",
      "publishedAt": "2024-02-06T08:30:00.000Z",
      "memberCount": 25
    }
  ]
}
```

### 14. Remove Quiz from Group

**Endpoint:** `DELETE /quizzes/:QuizID/groups/:GroupID`  
**Access:** Quiz creator (teacher) only

**Response:**

```json
{
  "success": true,
  "message": "Quiz removed from group successfully"
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description"
}
```

### Common HTTP Status Codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

---

## Frontend Integration Notes

### 1. Authentication Flow

- Ensure JWT token is included in all requests
- Handle token expiration (401 responses)
- Implement token refresh logic

### 2. Role-Based Access

- Teachers can create groups, add students, publish quizzes
- Students can accept/reject invitations, view published quizzes
- Implement UI guards based on user roles

### 3. Email Integration

- Group invitations are sent automatically via email
- Include accept/reject links in emails (pointing to frontend routes)
- Handle email verification for new users

### 4. Real-time Updates

- Consider implementing WebSocket or polling for:
  - New group invitations
  - Quiz publications
  - Group membership changes

### 5. Data Caching

- Cache group lists and published quizzes
- Invalidate cache on relevant operations
- Implement optimistic updates for better UX

### 6. Error Handling

- Display user-friendly error messages
- Implement retry logic for failed requests
- Handle network connectivity issues

### 7. Search Optimization

- Implement debounced search for user lookup
- Cache recent search results
- Show loading states during search

### 8. Group Management UI

- Display group member counts and statuses
- Show invitation timestamps
- Implement bulk operations for adding/removing students

### 9. Quiz Publishing Flow

- Allow teachers to select multiple groups when publishing
- Show publication status and timestamps
- Display which groups a quiz is published to

### 10. Student Dashboard

- Show pending invitations prominently
- Display accepted groups and their quizzes
- Implement one-click accept/reject actions

---

## Environment Variables Required

Add these to your `.env` file:

```
# Existing variables...
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:3000  # or your frontend URL
```

---

## Database Schema

The feature adds these new tables:

- `groups`: Group information
- `group_members`: Group membership and invitation status
- `quiz_groups`: Quiz-to-group publications

Run migrations after updating the schema:

```bash
npx prisma migrate dev --name add_groups_and_quiz_groups
```
