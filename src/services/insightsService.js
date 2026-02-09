const OpenAI = require('openai');

// Initialize OpenAI client with Groq
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/**
 * Generate comprehensive AI insights for a quiz response
 * @param {Object} response - Quiz response object with answers, quiz, and user data
 * @returns {Object} - Structured insights object
 */
exports.generateAIInsights = async (response) => {
  try {
    // Prepare data for AI analysis
    const analysisData = prepareAnalysisData(response);

    // Generate insights using Groq AI
    const prompt = createInsightsPrompt(analysisData);

    const response = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational AI assistant that provides detailed, constructive, and personalized learning insights based on quiz performance. Your insights should be encouraging, specific, and actionable.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: process.env.GROQ_AI_MODEL || "llama3-8b-8192",
      temperature: 0.3,
      max_tokens: 4000
    });

    const aiResponse = response.choices[0].message.content;

    // Parse and structure the AI response
    const insights = parseAIInsights(aiResponse, analysisData);

    return insights;

  } catch (error) {
    console.error('Error generating AI insights:', error);
    
    // Fallback to basic insights if AI fails
    return generateBasicInsights(response);
  }
};

/**
 * Prepare quiz response data for AI analysis
 */
function prepareAnalysisData(response) {
  const correctAnswers = response.Answers.filter(a => a.IsCorrect).length;
  const incorrectAnswers = response.Answers.filter(a => !a.IsCorrect).length;
  const totalQuestions = response.Answers.length;

  // Categorize questions by topic/concept if available
  const questionsAnalysis = response.Answers.map(answer => ({
    questionText: answer.Question.QuestionText,
    questionType: answer.Question.QuestionType,
    isCorrect: answer.IsCorrect,
    pointsEarned: answer.PointsEarned,
    maxPoints: answer.Question.Points,
    userAnswer: answer.SelectedOption?.OptionText || answer.AnswerText,
    correctAnswer: answer.Question.Options?.find(opt => opt.IsCorrect)?.OptionText,
    timeTaken: answer.TimeTaken
  }));

  // Find patterns in mistakes
  const incorrectQuestions = questionsAnalysis.filter(q => !q.isCorrect);
  const slowQuestions = questionsAnalysis.filter(q => q.timeTaken && q.timeTaken > 60); // Questions taking more than 60 seconds

  return {
    quizTitle: response.Quiz.Title,
    quizDifficulty: response.Quiz.Difficulty,
    quizSubject: response.Quiz.Subject,
    studentName: `${response.User.FirstName || ''} ${response.User.LastName || ''}`.trim(),
    score: response.Score,
    totalScore: response.TotalScore,
    percentage: response.Percentage,
    correctAnswers,
    incorrectAnswers,
    totalQuestions,
    timeSpent: response.TimeSpent,
    questionsAnalysis,
    incorrectQuestions,
    slowQuestions
  };
}

/**
 * Create a detailed prompt for AI insights generation
 */
function createInsightsPrompt(data) {
  return `
You are an expert educational analyst and learning specialist. Analyze this quiz performance data in extreme detail and provide comprehensive, actionable insights that will genuinely help the student improve.

**QUIZ CONTEXT:**
- Title: ${data.quizTitle}
- Subject Area: ${data.quizSubject || 'General Knowledge'}
- Difficulty Level: ${data.quizDifficulty}
- Total Questions: ${data.totalQuestions}
- Student Performance: ${data.correctAnswers}/${data.totalQuestions} correct (${data.percentage.toFixed(2)}%)
- Time Spent: ${data.timeSpent ? `${Math.floor(data.timeSpent / 60)} minutes ${data.timeSpent % 60} seconds` : 'Not recorded'}
- Student: ${data.studentName}

**QUESTION-BY-QUESTION ANALYSIS:**
${data.questionsAnalysis.map((q, i) => `
Question ${i + 1}: "${q.questionText}"
- Status: ${q.isCorrect ? 'CORRECT' : 'INCORRECT'}
- Time Taken: ${q.timeTaken ? `${q.timeTaken} seconds` : 'Not recorded'}
- Student Answer: ${q.userAnswer || 'No answer provided'}
- Correct Answer: ${q.correctAnswer || 'N/A'}
- Points Earned: ${q.pointsEarned}/${q.maxPoints}
`).join('\n')}

**PATTERN ANALYSIS REQUEST:**
Analyze this performance data and identify:
1. **Knowledge Gaps**: What specific concepts does the student struggle with?
2. **Misconceptions**: What wrong ideas or approaches does the student have?
3. **Strength Areas**: What concepts has the student mastered?
4. **Learning Style**: Does the student work better with certain question types?
5. **Time Management**: How does the student allocate time across different topics?
6. **Consistency**: Are there patterns in when the student gets questions right/wrong?

**REQUIRED DETAILED ANALYSIS:**

Provide a comprehensive analysis in this exact JSON structure:
{
  "overallPerformance": {
    "grade": "A+/A/B+/B/C+/C/D/F",
    "letterGrade": "A/B/C/D/F",
    "percentage": ${data.percentage.toFixed(2)},
    "performanceLevel": "Excellent/Good/Satisfactory/Needs Improvement/Poor",
    "summary": "3-4 sentence detailed assessment of overall performance",
    "keyStrengths": ["Specific strength 1", "Specific strength 2", "Specific strength 3"],
    "majorWeaknesses": ["Specific weakness 1", "Specific weakness 2"],
    "improvementAreas": ["Area needing work 1", "Area needing work 2"]
  },
  "conceptualAnalysis": {
    "masteredConcepts": ["Concept fully understood 1", "Concept fully understood 2"],
    "partiallyUnderstoodConcepts": ["Concept with partial understanding 1", "Concept with partial understanding 2"],
    "misunderstoodConcepts": ["Concept with major gaps 1", "Concept with major gaps 2"],
    "knowledgeGaps": ["Specific missing knowledge 1", "Specific missing knowledge 2"]
  },
  "questionTypeAnalysis": {
    "bestPerformingType": "Multiple choice / True-false / Short answer",
    "worstPerformingType": "Multiple choice / True-false / Short answer",
    "recommendedFocus": "Which question type needs more practice"
  },
  "timeManagementAnalysis": {
    "averageTimePerQuestion": "X seconds",
    "timeEfficiency": "Efficient / Could be better / Needs improvement",
    "slowQuestions": ["Question topics that took too long"],
    "fastQuestions": ["Question topics answered quickly"],
    "timeRecommendations": ["Specific time management advice"]
  },
  "detailedRecommendations": [
    {
      "priority": "high/medium/low",
      "category": "Study Technique / Content Review / Practice / Time Management",
      "specificAction": "Exact actionable step",
      "expectedImpact": "How this will help",
      "timeline": "Immediate / This week / This month"
    }
  ],
  "learningPath": {
    "immediateActions": ["Next 3 things to do today/tomorrow"],
    "shortTermGoals": ["Goals for next week"],
    "longTermStrategy": ["Overall learning approach"],
    "resourceSuggestions": ["Specific study materials or methods"]
  },
  "motivationalInsights": {
    "progressAssessment": "How much progress has been made",
    "confidenceBuilding": "Specific encouragement based on performance",
    "growthMindset": "Message promoting growth mindset",
    "nextChallenge": "Appropriate next difficulty level or topic"
  },
  "predictiveAnalysis": {
    "likelyScoreImprovement": "Expected score range with recommended actions",
    "riskAreas": ["Topics likely to cause issues in future assessments"],
    "readinessLevel": "Prepared for similar difficulty / Needs more practice"
  }
}

**CRITICAL REQUIREMENTS:**
- Be extremely specific - avoid general statements like "study more"
- Reference actual questions and topics from the quiz
- Provide measurable, actionable recommendations
- Consider the student's current performance level
- Include both encouragement and constructive criticism
- Make suggestions realistic and achievable

Provide ONLY the JSON response with no additional text or formatting.
`;
}

/**
 * Parse AI response into structured insights
 */
function parseAIInsights(aiResponse, analysisData) {
  try {
    // Try to parse JSON from AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Add metadata
      return {
        ...parsed,
        metadata: {
          generatedAt: new Date().toISOString(),
          quizScore: analysisData.score,
          quizTotalScore: analysisData.totalScore,
          percentage: analysisData.percentage,
          correctAnswers: analysisData.correctAnswers,
          totalQuestions: analysisData.totalQuestions,
          difficulty: analysisData.quizDifficulty
        },
        questionBreakdown: analysisData.questionsAnalysis.map((q, index) => ({
          questionNumber: index + 1,
          isCorrect: q.isCorrect,
          timeTaken: q.timeTaken,
          needsReview: !q.isCorrect || (q.timeTaken && q.timeTaken > 60)
        }))
      };
    }
    
    throw new Error('Failed to parse AI response as JSON');
  } catch (error) {
    console.error('Error parsing AI insights:', error);
    return generateBasicInsights(analysisData);
  }
}

/**
 * Generate basic insights as fallback
 */
function generateBasicInsights(data) {
  const percentage = typeof data.Percentage !== 'undefined' ? data.Percentage : data.percentage;
  const correctAnswers = typeof data.correctAnswers !== 'undefined' ? data.correctAnswers : 0;
  const totalQuestions = typeof data.totalQuestions !== 'undefined' ? data.totalQuestions : data.Answers?.length || 0;

  let grade = 'F';
  let letterGrade = 'F';
  let performanceLevel = 'Poor';

  if (percentage >= 95) {
    grade = 'A+';
    letterGrade = 'A';
    performanceLevel = 'Excellent';
  } else if (percentage >= 90) {
    grade = 'A';
    letterGrade = 'A';
    performanceLevel = 'Excellent';
  } else if (percentage >= 85) {
    grade = 'B+';
    letterGrade = 'B';
    performanceLevel = 'Good';
  } else if (percentage >= 80) {
    grade = 'B';
    letterGrade = 'B';
    performanceLevel = 'Good';
  } else if (percentage >= 75) {
    grade = 'C+';
    letterGrade = 'C';
    performanceLevel = 'Satisfactory';
  } else if (percentage >= 70) {
    grade = 'C';
    letterGrade = 'C';
    performanceLevel = 'Satisfactory';
  } else if (percentage >= 60) {
    grade = 'D';
    letterGrade = 'D';
    performanceLevel = 'Needs Improvement';
  }

  const keyStrengths = [];
  const majorWeaknesses = [];
  const improvementAreas = [];

  if (percentage >= 70) {
    keyStrengths.push('Good overall understanding of the subject matter');
    if (percentage >= 85) {
      keyStrengths.push('Excellent accuracy in answering questions');
      keyStrengths.push('Strong grasp of core concepts');
    }
  } else {
    majorWeaknesses.push('Need to strengthen fundamental concepts');
    improvementAreas.push('Review quiz material and focus on areas where mistakes were made');
  }

  if (correctAnswers / totalQuestions < 0.5) {
    majorWeaknesses.push('More than half of the questions were answered incorrectly');
    improvementAreas.push('Consider reviewing course materials before attempting similar quizzes');
  }

  const averageTimePerQuestion = data.timeSpent ? Math.round(data.timeSpent / totalQuestions) : null;
  const timeEfficiency = averageTimePerQuestion ?
    (averageTimePerQuestion < 30 ? 'Efficient' : averageTimePerQuestion < 60 ? 'Could be better' : 'Needs improvement') :
    'Not available';

  return {
    overallPerformance: {
      grade,
      letterGrade,
      percentage: percentage.toFixed(2),
      performanceLevel,
      summary: `You scored ${percentage.toFixed(2)}% on this quiz, answering ${correctAnswers} out of ${totalQuestions} questions correctly. ${percentage >= 70 ? 'This demonstrates a solid understanding of the material.' : 'There are opportunities for improvement in several key areas.'}`,
      keyStrengths,
      majorWeaknesses,
      improvementAreas
    },
    conceptualAnalysis: {
      masteredConcepts: percentage >= 80 ? ['Core concepts from the quiz material'] : [],
      partiallyUnderstoodConcepts: percentage >= 60 && percentage < 80 ? ['Some fundamental concepts'] : [],
      misunderstoodConcepts: percentage < 60 ? ['Several key concepts covered in the quiz'] : [],
      knowledgeGaps: percentage < 70 ? ['Topics where incorrect answers were given'] : []
    },
    questionTypeAnalysis: {
      bestPerformingType: "Cannot determine from available data",
      worstPerformingType: "Cannot determine from available data",
      recommendedFocus: "Review all question types for better understanding"
    },
    timeManagementAnalysis: {
      averageTimePerQuestion: averageTimePerQuestion ? `${averageTimePerQuestion} seconds` : 'Not available',
      timeEfficiency,
      slowQuestions: data.slowQuestions?.length > 0 ? data.slowQuestions.map(q => q.questionText.substring(0, 50) + '...') : [],
      fastQuestions: [],
      timeRecommendations: averageTimePerQuestion && averageTimePerQuestion > 60 ?
        ['Consider allocating more time for reading questions carefully', 'Practice time management techniques'] :
        ['Good time management overall']
    },
    detailedRecommendations: [
      {
        priority: percentage < 70 ? 'high' : 'medium',
        category: 'Content Review',
        specificAction: 'Review all incorrect answers and understand why they were wrong',
        expectedImpact: 'Will help identify specific knowledge gaps and improve future performance',
        timeline: 'Immediate'
      },
      {
        priority: 'medium',
        category: 'Practice',
        specificAction: 'Take additional practice quizzes on similar topics',
        expectedImpact: 'Will reinforce learning and build confidence',
        timeline: 'This week'
      }
    ],
    learningPath: {
      immediateActions: [
        'Review all questions you got wrong',
        'Note down the concepts you struggled with',
        'Research those specific topics'
      ],
      shortTermGoals: [
        'Improve score by at least 10% on next similar quiz',
        'Master the concepts you missed in this quiz'
      ],
      longTermStrategy: [
        'Develop a systematic study approach',
        'Regular practice with spaced repetition'
      ],
      resourceSuggestions: [
        'Review course materials related to missed questions',
        'Use online resources for difficult topics'
      ]
    },
    motivationalInsights: {
      progressAssessment: percentage >= 70 ? 'Showing good progress in this subject area' : 'Room for improvement with focused study',
      confidenceBuilding: percentage >= 70 ?
        'Your performance shows you have the ability to succeed in this subject' :
        'Every expert was once a beginner - keep practicing!',
      growthMindset: 'Intelligence and abilities can be developed through dedication and hard work',
      nextChallenge: percentage >= 80 ? 'Try a more challenging quiz' : 'Focus on mastering current difficulty level first'
    },
    predictiveAnalysis: {
      likelyScoreImprovement: percentage >= 70 ? '80-90%' : '70-85%',
      riskAreas: percentage < 70 ? ['Similar topics to those missed in this quiz'] : [],
      readinessLevel: percentage >= 80 ? 'Prepared for similar difficulty' : 'Needs more practice before advancing'
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      quizScore: data.Score || data.score,
      quizTotalScore: data.TotalScore || data.totalScore,
      percentage: percentage,
      correctAnswers: correctAnswers,
      totalQuestions: totalQuestions,
      difficulty: data.Quiz?.Difficulty || data.quizDifficulty || 'medium'
    },
    questionBreakdown: data.questionsAnalysis?.map((q, index) => ({
      questionNumber: index + 1,
      isCorrect: q.isCorrect,
      timeTaken: q.timeTaken,
      needsReview: !q.isCorrect || (q.timeTaken && q.timeTaken > 60)
    })) || []
  };
}

/**
 * Generate comparative insights (compare with other attempts or class average)
 */
exports.generateComparativeInsights = async (userId, quizId) => {
  try {
    const { default: prisma } = require('../lib/prismaClient');

    // Get all user's responses for this quiz
    const userResponses = await prisma.quizResponse.findMany({
      where: {
        UserID: userId,
        QuizID: quizId,
        Status: 'completed'
      },
      orderBy: {
        CompletedAt: 'asc'
      }
    });

    // Get class average
    const allResponses = await prisma.quizResponse.findMany({
      where: {
        QuizID: quizId,
        Status: 'completed'
      }
    });

    const classAverage = allResponses.length > 0
      ? allResponses.reduce((sum, r) => sum + r.Percentage, 0) / allResponses.length
      : 0;

    const insights = {
      userProgress: {
        attempts: userResponses.length,
        scores: userResponses.map(r => r.Percentage),
        improvement: userResponses.length > 1
          ? userResponses[userResponses.length - 1].Percentage - userResponses[0].Percentage
          : 0
      },
      classComparison: {
        classAverage: classAverage.toFixed(2),
        userLatestScore: userResponses.length > 0 ? userResponses[userResponses.length - 1].Percentage : 0,
        performanceVsClass: userResponses.length > 0
          ? userResponses[userResponses.length - 1].Percentage - classAverage
          : 0
      }
    };

    return insights;

  } catch (error) {
    console.error('Error generating comparative insights:', error);
    return null;
  }
};
