const OpenAI = require('openai');

/**
 * Initialize OpenAI client with Groq
 */
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/**
 * Generate quiz with AI from content
 */
const generateQuizWithAI = async ({
  content,
  title,
  description,
  difficulty,
  subject,
  numQuestions,
  timeLimit
}) => {
  try {
    // Truncate content if too long (to manage token limits)
    const maxContentLength = 10000; // Adjust based on model limits
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '...'
      : content;

    // Create the prompt for quiz generation
    const prompt = createQuizGenerationPrompt({
      content: truncatedContent,
      title,
      description,
      difficulty,
      subject,
      numQuestions,
      timeLimit
    });

    // Call Groq API
    const response = await client.chat.completions.create({
      model: process.env.GROQ_AI_MODEL || "llama3-8b-8192", // Use env variable or fallback to stable model
      messages: [
        {
          role: "system",
          content: "You are an expert educator who creates high-quality, educational quizzes. You MUST respond with ONLY valid JSON - no markdown, no code blocks, no thinking process, no explanations, no additional text. Start directly with { and end with }."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent JSON output
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const aiResponse = response.choices[0].message.content;

    // Parse the JSON response
    let quizData;
    try {
      // Clean the response by removing any extra content
      let cleanedResponse = aiResponse.trim();

      // Remove thinking tags if present
      cleanedResponse = cleanedResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // Remove markdown code blocks (```json ... ```)
      if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```(?:json)?\s*\n?/g, '').replace(/```/g, '');
      }

      // Extract JSON by finding the first { and last }
      const firstBrace = cleanedResponse.indexOf('{');
      const lastBrace = cleanedResponse.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.error('No valid JSON object found in AI response');
        console.error('AI Response:', aiResponse.substring(0, 500));
        throw new Error('No valid JSON object found in response');
      }

      cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);

      quizData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse.substring(0, 500));
      console.error('Parse error:', parseError.message);
      throw new Error('Invalid response format from AI service');
    }

    // Validate the response structure
    validateQuizResponse(quizData);

    return {
      title: quizData.title,
      description: quizData.description,
      difficulty: quizData.difficulty,
      subject: quizData.subject,
      timeLimit: quizData.timeLimit,
      questions: quizData.questions
    };

  } catch (error) {
    console.error('AI quiz generation error:', error);
    throw new Error(`Failed to generate quiz with AI: ${error.message}`);
  }
};

/**
 * Create the prompt for quiz generation
 */
const createQuizGenerationPrompt = ({
  content,
  title,
  description,
  difficulty,
  subject,
  numQuestions,
  timeLimit
}) => {
  const difficultyDescriptions = {
    easy: "basic concepts, simple recall, straightforward questions",
    medium: "moderate complexity, some analysis, application of concepts",
    hard: "advanced understanding, complex analysis, synthesis of information"
  };

  return `Based on the following content, create a quiz with exactly ${numQuestions} multiple-choice questions.

CONTENT TITLE: ${title}
CONTENT DESCRIPTION: ${description || 'No description provided'}
DIFFICULTY LEVEL: ${difficulty} (${difficultyDescriptions[difficulty]})
SUBJECT: ${subject || 'General'}
TIME LIMIT: ${timeLimit || 'No time limit'} minutes
NUMBER OF QUESTIONS: ${numQuestions}

CONTENT:
${content}

REQUIREMENTS:
1. Create exactly ${numQuestions} multiple-choice questions
2. Each question must have exactly 4 options (A, B, C, D)
3. Only one option should be correct for each question
4. Questions should be ${difficultyDescriptions[difficulty]}
5. Questions should be based only on the provided content
6. Avoid questions that require external knowledge
7. Make sure questions test understanding, not just memorization
8. Provide clear, unambiguous questions and options

RESPONSE FORMAT - You MUST respond with this exact JSON structure:
{
  "title": "${title}",
  "description": "${description || ''}",
  "difficulty": "${difficulty}",
  "subject": "${subject || ''}",
  "timeLimit": ${timeLimit || null},
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this is correct",
      "points": 1
    }
  ]
}

CRITICAL RULES:
- Start your response with { (opening brace)
- End your response with } (closing brace)
- NO thinking process, NO explanations outside the JSON
- NO markdown formatting, NO code blocks
- ONLY valid JSON`;
};

/**
 * Validate the AI response structure
 */
const validateQuizResponse = (data) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response: response must be a valid object');
  }

  // Check required fields
  const requiredFields = ['title', 'description', 'difficulty', 'subject', 'timeLimit', 'questions'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Invalid response: missing required field '${field}'`);
    }
  }

  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('Invalid response: questions must be an array');
  }

  if (data.questions.length === 0) {
    throw new Error('Invalid response: no questions generated');
  }

  // Validate difficulty
  const validDifficulties = ['easy', 'medium', 'hard'];
  if (!validDifficulties.includes(data.difficulty)) {
    throw new Error(`Invalid response: difficulty must be one of ${validDifficulties.join(', ')}`);
  }

  // Validate timeLimit
  if (typeof data.timeLimit !== 'number' || data.timeLimit <= 0) {
    throw new Error('Invalid response: timeLimit must be a positive number');
  }

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];

    if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
      throw new Error(`Question ${i + 1}: question text is required and must be a non-empty string`);
    }

    if (!q.options || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${i + 1}: must have exactly 4 options`);
    }

    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3 || !Number.isInteger(q.correctAnswer)) {
      throw new Error(`Question ${i + 1}: correctAnswer must be an integer between 0 and 3`);
    }

    // Validate that all options are non-empty strings
    for (let j = 0; j < q.options.length; j++) {
      if (typeof q.options[j] !== 'string' || q.options[j].trim().length === 0) {
        throw new Error(`Question ${i + 1}, Option ${j + 1}: option must be a non-empty string`);
      }
    }

    // Optional fields validation
    if (q.explanation && typeof q.explanation !== 'string') {
      throw new Error(`Question ${i + 1}: explanation must be a string if provided`);
    }

    if (q.points && (typeof q.points !== 'number' || q.points <= 0 || !Number.isInteger(q.points))) {
      throw new Error(`Question ${i + 1}: points must be a positive integer if provided`);
    }
  }
};

module.exports = {
  generateQuizWithAI
};