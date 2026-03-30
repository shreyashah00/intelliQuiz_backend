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
exports.generateAIInsights = async (quizResponse) => {
  let analysisData;

  try {
    // Prepare data for AI analysis
    analysisData = prepareAnalysisData(quizResponse);

    // Generate insights using Groq AI
    const { systemPrompt, userPrompt } = createInsightsPrompt(analysisData);

    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      model: process.env.GROQ_AI_MODEL || "llama3-8b-8192",
      temperature: 0.2,
      max_tokens: 3000
    });

    const aiResponse = completion?.choices?.[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('AI model returned an empty response');
    }

    // Parse and structure the AI response
    const insights = parseAIInsights(aiResponse, analysisData);

    return insights;

  } catch (error) {
    console.error('Error generating AI insights:', error);
    
    // Fallback to basic insights if AI fails
    return generateBasicInsights(analysisData || quizResponse);
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
    questionId: answer.Question.QuestionID,
    orderIndex: answer.Question.OrderIndex,
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
  const promptPayload = {
    quizContext: {
      title: data.quizTitle,
      subject: data.quizSubject || 'General Knowledge',
      difficulty: data.quizDifficulty,
      totalQuestions: data.totalQuestions
    },
    studentContext: {
      name: data.studentName || 'Student'
    },
    performanceSummary: {
      score: data.score,
      totalScore: data.totalScore,
      percentage: Number(data.percentage.toFixed(2)),
      correctAnswers: data.correctAnswers,
      incorrectAnswers: data.incorrectAnswers,
      timeSpentSeconds: data.timeSpent || null,
      averageTimePerQuestion: data.timeSpent && data.totalQuestions > 0
        ? Math.round(data.timeSpent / data.totalQuestions)
        : null
    },
    responses: data.questionsAnalysis.map((q, i) => ({
      questionNumber: i + 1,
      questionId: q.questionId,
      orderIndex: q.orderIndex,
      questionType: q.questionType,
      questionText: q.questionText,
      isCorrect: q.isCorrect,
      pointsEarned: q.pointsEarned,
      maxPoints: q.maxPoints,
      timeTakenSeconds: q.timeTaken || null,
      studentAnswer: q.userAnswer || null,
      correctAnswer: q.correctAnswer || null
    }))
  };

  const systemPrompt = [
    'You are an educational assessment expert and personalized learning coach.',
    'Use only the provided quiz data. Do not invent topics, scores, or mistakes.',
    'Return one valid JSON object only, without markdown fences or extra text.',
    'Keep guidance constructive, practical, and specific to this student.'
  ].join(' ');

  const userPrompt = `
Analyze this quiz response dataset and generate specific learning insights.

DATASET (JSON):
${JSON.stringify(promptPayload, null, 2)}

Return JSON with this exact top-level structure:
{
  "overallPerformance": {
    "grade": "A+|A|B+|B|C+|C|D|F",
    "letterGrade": "A|B|C|D|F",
    "percentage": number,
    "performanceLevel": "Excellent|Good|Satisfactory|Needs Improvement|Poor",
    "summary": "3-4 sentence summary grounded in this quiz only",
    "keyStrengths": ["..."],
    "majorWeaknesses": ["..."],
    "improvementAreas": ["..."]
  },
  "conceptualAnalysis": {
    "masteredConcepts": ["..."],
    "partiallyUnderstoodConcepts": ["..."],
    "misunderstoodConcepts": ["..."],
    "knowledgeGaps": ["..."]
  },
  "questionTypeAnalysis": {
    "bestPerformingType": "multiple_choice|true_false|short_answer|mixed",
    "worstPerformingType": "multiple_choice|true_false|short_answer|mixed",
    "recommendedFocus": "..."
  },
  "timeManagementAnalysis": {
    "averageTimePerQuestion": "...",
    "timeEfficiency": "Efficient|Could be better|Needs improvement|Not available",
    "slowQuestions": ["question numbers or brief topics"],
    "fastQuestions": ["question numbers or brief topics"],
    "timeRecommendations": ["..."]
  },
  "detailedRecommendations": [
    {
      "priority": "high|medium|low",
      "category": "Study Technique|Content Review|Practice|Time Management",
      "specificAction": "clear, measurable action",
      "expectedImpact": "...",
      "timeline": "Immediate|This week|This month"
    }
  ],
  "learningPath": {
    "immediateActions": ["..."],
    "shortTermGoals": ["..."],
    "longTermStrategy": ["..."],
    "resourceSuggestions": ["..."]
  },
  "motivationalInsights": {
    "progressAssessment": "...",
    "confidenceBuilding": "...",
    "growthMindset": "...",
    "nextChallenge": "..."
  },
  "predictiveAnalysis": {
    "likelyScoreImprovement": "...",
    "riskAreas": ["..."],
    "readinessLevel": "Prepared for similar difficulty|Needs more practice"
  }
}

Rules:
- Reference evidence using question numbers when possible.
- Do not use generic advice like "study more" without concrete actions.
- Keep recommendations realistic for the student's current level.
- If data is missing (for example short answer correctness), explicitly say so in relevant fields.
`.trim();

  return { systemPrompt, userPrompt };
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
      const normalized = normalizeInsights(parsed, analysisData);
      
      // Add metadata
      return {
        ...normalized,
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

function normalizeInsights(rawInsights, data) {
  const safeInsights = rawInsights && typeof rawInsights === 'object' ? rawInsights : {};
  const base = generateBasicInsights(data);

  const missedQuestionNumbers = data.questionsAnalysis
    .map((q, idx) => ({ idx, isCorrect: q.isCorrect }))
    .filter(item => !item.isCorrect)
    .map(item => item.idx + 1);

  const quizLabel = [data.quizDifficulty, data.quizSubject].filter(Boolean).join(' ');
  const factualSummary = `${data.studentName || 'Student'} answered ${data.correctAnswers}/${data.totalQuestions} questions correctly (${Number(data.percentage).toFixed(2)}%) in ${quizLabel || 'this'} quiz.${missedQuestionNumbers.length > 0 ? ` Questions ${missedQuestionNumbers.join(', ')} need review.` : ' Great accuracy across all questions.'}`;

  const merged = {
    ...base,
    ...safeInsights,
    overallPerformance: {
      ...base.overallPerformance,
      ...(safeInsights.overallPerformance || {}),
      summary: factualSummary,
      keyStrengths: asArray(
        safeInsights?.overallPerformance?.keyStrengths || safeInsights?.overallPerformance?.strengths,
        base.overallPerformance.keyStrengths
      ),
      majorWeaknesses: asArray(
        safeInsights?.overallPerformance?.majorWeaknesses || safeInsights?.overallPerformance?.weaknesses,
        base.overallPerformance.majorWeaknesses
      ),
      improvementAreas: asArray(
        safeInsights?.overallPerformance?.improvementAreas,
        base.overallPerformance.improvementAreas
      )
    },
    conceptualAnalysis: {
      ...base.conceptualAnalysis,
      ...(safeInsights.conceptualAnalysis || {})
    },
    questionTypeAnalysis: {
      ...base.questionTypeAnalysis,
      ...(safeInsights.questionTypeAnalysis || {})
    },
    timeManagementAnalysis: {
      ...base.timeManagementAnalysis,
      ...(safeInsights.timeManagementAnalysis || {})
    },
    detailedRecommendations: Array.isArray(safeInsights.detailedRecommendations) && safeInsights.detailedRecommendations.length > 0
      ? safeInsights.detailedRecommendations
      : base.detailedRecommendations,
    learningPath: {
      ...base.learningPath,
      ...(safeInsights.learningPath || {})
    },
    motivationalInsights: {
      ...base.motivationalInsights,
      ...(safeInsights.motivationalInsights || {})
    },
    predictiveAnalysis: {
      ...base.predictiveAnalysis,
      ...(safeInsights.predictiveAnalysis || {})
    }
  };

  // Backward-compatible keys used by existing frontend pages.
  merged.overallPerformance.strengths = merged.overallPerformance.keyStrengths;
  merged.overallPerformance.weaknesses = merged.overallPerformance.majorWeaknesses;
  merged.recommendations = merged.detailedRecommendations.map(rec => rec.specificAction || rec.expectedImpact).filter(Boolean);
  merged.nextSteps = asArray(merged.learningPath.immediateActions, []);
  merged.motivationalMessage = merged.motivationalInsights.confidenceBuilding || merged.motivationalInsights.growthMindset || '';

  return merged;
}

function asArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'string' && item.trim().length > 0);
  }

  return fallback;
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
