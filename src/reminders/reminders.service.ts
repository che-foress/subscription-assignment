import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmailService } from './email.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Automatically scheduled cron job: runs daily at midnight to check and send reminders.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCronReminders() {
    this.logger.log('Starting daily automated payment reminder check...');
    return this.processUpcomingReminders(3);
  }

  /**
   * Scans active subscriptions and sends reminder emails for billing dates falling within the next 3 days.
   * Enforces duplicate prevention for the same subscription and billing date.
   *
   * @param daysAhead Number of days before the billing date to trigger a reminder (default: 3 days)
   */
  async processUpcomingReminders(daysAhead: number = 3) {
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: {
        user: true,
      },
    });

    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysAhead);

    const processed = [];

    for (const sub of activeSubscriptions) {
      const nextBillingDate = this.subscriptionsService.calculateNextBillingDate(
        sub.billingDate,
        sub.billingCycle,
        now,
      );

      // Check if billing date is within the window [now, now + daysAhead]
      if (nextBillingDate >= now && nextBillingDate <= thresholdDate) {
        // PREVENT DUPLICATES: Check if a successful reminder has already been sent for this subscription & billing date
        const existingSuccessReminder =
          await this.prisma.reminderHistory.findFirst({
            where: {
              subscriptionId: sub.id,
              scheduledFor: nextBillingDate,
              status: ReminderStatus.SUCCESS,
            },
          });

        if (existingSuccessReminder) {
          this.logger.log(
            `[DUPLICATE PREVENTED] Reminder already sent for subscription "${sub.name}" on billing date ${nextBillingDate.toISOString().split('T')[0]}`,
          );
          continue;
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const diffTime = nextBillingDate.getTime() - now.getTime();
        const daysLeft = Math.max(1, Math.ceil(diffTime / msPerDay));

        try {
          // Send reminder email to subscription owner
          await this.emailService.sendReminderEmail({
            to: sub.user.email,
            userName: sub.user.name,
            subscriptionName: sub.name,
            amount: sub.amount,
            billingDate: nextBillingDate,
            subscriptionId: sub.id,
            billingCycle: sub.billingCycle,
            daysLeft,
          });

          // Store reminder history in the database with SUCCESS status
          const reminder = await this.prisma.reminderHistory.create({
            data: {
              subscriptionId: sub.id,
              scheduledFor: nextBillingDate,
              status: ReminderStatus.SUCCESS,
            },
          });

          processed.push({
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            amount: sub.amount,
            nextBillingDate,
            userEmail: sub.user.email,
            status: ReminderStatus.SUCCESS,
            reminderId: reminder.id,
          });
        } catch (error) {
          // Handle email delivery failures appropriately
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to send reminder for subscription "${sub.name}" (${sub.id}): ${errorMessage}`,
          );

          // Store failure in reminder history
          await this.prisma.reminderHistory.create({
            data: {
              subscriptionId: sub.id,
              scheduledFor: nextBillingDate,
              status: ReminderStatus.FAILED,
              errorMessage,
            },
          });

          processed.push({
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            amount: sub.amount,
            nextBillingDate,
            userEmail: sub.user.email,
            status: ReminderStatus.FAILED,
            errorMessage,
          });
        }
      }
    }

    return {
      message: `Processed reminders for ${processed.length} upcoming subscriptions`,
      processedCount: processed.length,
      reminders: processed,
    };
  }

  /**
   * Retrieve all reminder history for a user's subscriptions.
   */
  async getHistoryForUser(userId: string) {
    return this.prisma.reminderHistory.findMany({
      where: {
        subscription: {
          userId,
        },
      },
      include: {
        subscription: {
          select: {
            id: true,
            name: true,
            amount: true,
            billingCycle: true,
          },
        },
      },
      orderBy: {
        sentAt: 'desc',
      },
    });
  }

  /**
   * Retrieve reminder history for a specific subscription, ensuring ownership.
   */
  async getHistoryForSubscription(userId: string, subscriptionId: string) {
    // Verify user owns the subscription
    await this.subscriptionsService.findOne(userId, subscriptionId);

    return this.prisma.reminderHistory.findMany({
      where: {
        subscriptionId,
      },
      orderBy: {
        sentAt: 'desc',
      },
    });
  }
}
