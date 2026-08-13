const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'IntelliQuiz';

async function sendEmailViaBrevo({ to, subject, html }) {
  if (!BREVO_API_KEY) {
    console.error('Brevo API key is not configured (BREVO_API_KEY is missing).');
    throw new Error('Email service configuration error');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: EMAIL_FROM_NAME,
        email: EMAIL_FROM,
      },
      to: [
        {
          email: to,
        },
      ],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Failed to send email via Brevo API:', errorData);
    throw new Error(errorData.message || 'Failed to send email');
  }

  return response.json();
}

async function sendOTPEmail(to, otp, username, type = 'Email Verification') {
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>IntelliQuiz</h1>
          <p>${type}</p>
        </div>
        <div class="content">
          <h2>Hello ${username || 'User'}!</h2>
          <p>Your verification code is:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Best regards,<br>IntelliQuiz Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailViaBrevo({
    to,
    subject: `${type} - IntelliQuiz`,
    html: emailTemplate,
  });
}

async function sendGroupInvitationEmail(to, username, groupName, groupId) {
  const acceptUrl = `${process.env.APP_URL}/groups/accept/${groupId}`;
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>IntelliQuiz</h1>
          <p>Group Invitation</p>
        </div>
        <div class="content">
          <h2>Hello ${username || 'Student'}!</h2>
          <p>You have been invited to join the group <strong>"${groupName}"</strong> on IntelliQuiz.</p>
          <p>As a member of this group, you'll have access to quizzes shared specifically with this group.</p>
          <a href="${acceptUrl}" class="button">Accept Invitation</a>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p><a href="${acceptUrl}">${acceptUrl}</a></p>
          <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
          <p>Best regards,<br>IntelliQuiz Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailViaBrevo({
    to,
    subject: `Group Invitation: ${groupName} - IntelliQuiz`,
    html: emailTemplate,
  });
}

async function sendQuizPublishedEmail(to, username, quizTitle, groupName, quizId) {
  const quizUrl = `${process.env.APP_URL}/quizzes/${quizId}`;
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .quiz-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>IntelliQuiz</h1>
          <p>New Quiz Available!</p>
        </div>
        <div class="content">
          <h2>Hello ${username || 'Student'}!</h2>
          <p>A new quiz has been published to your group <strong>"${groupName}"</strong>.</p>

          <div class="quiz-info">
            <h3>📚 ${quizTitle}</h3>
            <p>Your teacher has made this quiz available for you to take. Make sure to complete it within the allotted time!</p>
          </div>

          <a href="${quizUrl}" class="button">Take Quiz Now</a>

          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p><a href="${quizUrl}">${quizUrl}</a></p>

          <p>Good luck with your quiz!</p>
          <p>Best regards,<br>IntelliQuiz Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailViaBrevo({
    to,
    subject: `New Quiz Available: ${quizTitle} - IntelliQuiz`,
    html: emailTemplate,
  });
}

module.exports = { sendOTPEmail, sendGroupInvitationEmail, sendQuizPublishedEmail };
