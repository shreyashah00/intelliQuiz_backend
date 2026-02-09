const cron = require('node-cron');
const { default: prisma } = require('../lib/prismaClient');
const { sendQuizPublishedEmail } = require('../utils/mailer');

/**
 * Scheduled Quiz Publishing Service
 * Handles automatic publishing of scheduled quizzes to groups
 */
class ScheduledPublishingService {
  constructor() {
    this.isRunning = false;
    this.job = null;
  }

  /**
   * Start the scheduled publishing service
   * Runs every minute to check for quizzes that need to be published
   */
  start() {
    if (this.isRunning) {
      console.log('Scheduled publishing service is already running');
      return;
    }

    console.log('Starting scheduled quiz publishing service...');

    // Run every minute
    this.job = cron.schedule('* * * * *', async () => {
      try {
        console.log('[Cron] Checking for scheduled quizzes to publish...');
        await this.processScheduledQuizzes();
      } catch (error) {
        console.error('[Cron] Error in scheduled publishing job:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.isRunning = true;
    console.log('✓ Scheduled publishing service started successfully');
    console.log('✓ Cron job will run every minute');
  }

  /**
   * Stop the scheduled publishing service
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this.isRunning = false;
    console.log('Scheduled publishing service stopped');
  }

  /**
   * Process quizzes that are scheduled to be published
   */
  async processScheduledQuizzes() {
    try {
      const now = new Date();
      console.log(`[Cron] Checking at ${now.toISOString()}`);

      // Find all scheduled quizzes that are due to be published
      const scheduledQuizzes = await prisma.quizGroup.findMany({
        where: {
          Status: 'scheduled',
          IsScheduled: true,
          ScheduledAt: {
            lte: now // Scheduled time has passed
          }
        },
        include: {
          Quiz: {
            select: {
              QuizID: true,
              Title: true,
              CreatedBy: true
            }
          },
          Group: {
            select: {
              GroupID: true,
              Name: true,
              Members: {
                where: { Status: 'accepted' },
                select: { UserID: true }
              }
            }
          }
        }
      });

      if (scheduledQuizzes.length === 0) {
        console.log('[Cron] No scheduled quizzes to publish at this time');
        return; // No quizzes to publish
      }

      console.log(`[Cron] Found ${scheduledQuizzes.length} scheduled quiz(es) to publish`);

      // Process each scheduled quiz
      for (const scheduledQuiz of scheduledQuizzes) {
        try {
          await this.publishScheduledQuiz(scheduledQuiz);
        } catch (error) {
          console.error(`[Cron] Error publishing scheduled quiz ${scheduledQuiz.QuizGroupID}:`, error);
        }
      }

    } catch (error) {
      console.error('[Cron] Error processing scheduled quizzes:', error);
    }
  }

  /**
   * Publish a single scheduled quiz
   */
  async publishScheduledQuiz(scheduledQuiz) {
    const transaction = await prisma.$transaction(async (tx) => {
      // Update the quiz group status to published
      await tx.quizGroup.update({
        where: { QuizGroupID: scheduledQuiz.QuizGroupID },
        data: {
          Status: 'published',
          PublishedAt: new Date(),
          IsScheduled: false
        }
      });

      // Ensure the quiz is marked as published
      await tx.quiz.update({
        where: { QuizID: scheduledQuiz.QuizID },
        data: { IsPublished: true }
      });

      return scheduledQuiz;
    });

    console.log(`[Cron] ✓ Successfully published quiz "${transaction.Quiz.Title}" to group "${transaction.Group.Name}"`);

    // Send email notifications to all group members
    try {
      await this.sendQuizPublishedEmails(transaction);
    } catch (emailError) {
      console.error(`[Cron] Error sending email notifications for quiz ${transaction.Quiz.QuizID}:`, emailError);
      // Don't fail the publishing process if email fails
    }

    // TODO: Send notifications to group members about the new quiz
    // This could be implemented later with email notifications or in-app notifications

    return transaction;
  }

  /**
   * Send email notifications to all group members when a quiz is published
   */
  async sendQuizPublishedEmails(scheduledQuiz) {
    try {
      // Get all accepted group members with their email addresses
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          GroupID: scheduledQuiz.GroupID,
          Status: 'accepted'
        },
        include: {
          User: {
            select: {
              UserID: true,
              Email: true,
              FirstName: true,
              LastName: true,
              Username: true
            }
          }
        }
      });

      if (groupMembers.length === 0) {
        console.log(`[Email] No accepted members found for group ${scheduledQuiz.Group.Name}`);
        return;
      }

      console.log(`[Email] Sending quiz published notifications to ${groupMembers.length} members of group "${scheduledQuiz.Group.Name}"`);

      // Send email to each group member
      const emailPromises = groupMembers.map(async (member) => {
        try {
          const fullName = `${member.User.FirstName || ''} ${member.User.LastName || ''}`.trim();
          const displayName = fullName || member.User.Username;

          await sendQuizPublishedEmail(
            member.User.Email,
            displayName,
            scheduledQuiz.Quiz.Title,
            scheduledQuiz.Group.Name,
            scheduledQuiz.Quiz.QuizID
          );

          console.log(`[Email] ✓ Sent notification to ${member.User.Email} (${displayName})`);
        } catch (error) {
          console.error(`[Email] ✗ Failed to send email to ${member.User.Email}:`, error.message);
        }
      });

      await Promise.all(emailPromises);
      console.log(`[Email] ✓ Completed sending notifications for quiz "${scheduledQuiz.Quiz.Title}"`);

    } catch (error) {
      console.error('[Email] Error sending quiz published emails:', error);
      throw error;
    }
  }

  /**
   * Schedule a quiz for publishing
   */
  async scheduleQuizPublishing(quizId, groupId, scheduledAt) {
    try {
      // Validate the scheduled time is in the future
      const now = new Date();
      const scheduledTime = new Date(scheduledAt);

      if (scheduledTime <= now) {
        throw new Error('Scheduled time must be in the future');
      }

      // Update or create the quiz group with scheduling info
      const quizGroup = await prisma.quizGroup.upsert({
        where: {
          QuizID_GroupID: {
            QuizID: quizId,
            GroupID: groupId
          }
        },
        update: {
          IsScheduled: true,
          ScheduledAt: scheduledTime,
          Status: 'scheduled',
          PublishedAt: null
        },
        create: {
          QuizID: quizId,
          GroupID: groupId,
          IsScheduled: true,
          ScheduledAt: scheduledTime,
          Status: 'scheduled'
        }
      });

      console.log(`✓ Quiz ${quizId} scheduled for publishing to group ${groupId} at ${scheduledTime.toISOString()}`);
      return quizGroup;

    } catch (error) {
      console.error('Error scheduling quiz publishing:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled publishing
   */
  async cancelScheduledPublishing(quizId, groupId) {
    try {
      const quizGroup = await prisma.quizGroup.updateMany({
        where: {
          QuizID: quizId,
          GroupID: groupId,
          Status: 'scheduled'
        },
        data: {
          Status: 'cancelled',
          IsScheduled: false,
          ScheduledAt: null
        }
      });

      if (quizGroup.count === 0) {
        throw new Error('No scheduled publishing found for this quiz and group');
      }

      console.log(`Cancelled scheduled publishing for quiz ${quizId} to group ${groupId}`);
      return quizGroup;

    } catch (error) {
      console.error('Error cancelling scheduled publishing:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled quizzes for a teacher
   */
  async getScheduledQuizzesForTeacher(teacherId) {
    try {
      const scheduledQuizzes = await prisma.quizGroup.findMany({
        where: {
          Status: 'scheduled',
          Quiz: {
            CreatedBy: teacherId
          }
        },
        include: {
          Quiz: {
            select: {
              QuizID: true,
              Title: true,
              Subject: true,
              Difficulty: true
            }
          },
          Group: {
            select: {
              GroupID: true,
              Name: true,
              Description: true,
              _count: {
                select: { Members: { where: { Status: 'accepted' } } }
              }
            }
          }
        },
        orderBy: {
          ScheduledAt: 'asc'
        }
      });

      return scheduledQuizzes.map(item => ({
        ...item,
        Group: {
          ...item.Group,
          memberCount: item.Group._count.Members
        }
      }));

    } catch (error) {
      console.error('Error getting scheduled quizzes for teacher:', error);
      throw error;
    }
  }

  /**
   * Get status of the scheduling service
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.job ? 'Every minute' : 'Service not running'
    };
  }
}

// Create singleton instance
const scheduledPublishingService = new ScheduledPublishingService();

module.exports = scheduledPublishingService;