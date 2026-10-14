import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Automatically scheduled cron job: runs daily at midnight to check and send reminders.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCronReminders() {
    this.logger.log('Starting automated payment reminder check...');
    return this.processUpcomingReminders();
  }

  /**
   * Scans all active subscriptions and sends reminders for upcoming payments within the threshold days.
   * @param daysAhead Number of days before the billing date to trigger a reminder (default: 3 days)
   */
  async processUpcomingReminders(daysAhead: number = 3) {
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: {
        user: true,
        reminders: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
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
        // Avoid sending duplicate reminders on the same day for this subscription
        const lastReminder = sub.reminders[0];
        const alreadySentToday =
          lastReminder &&
          new Date(lastReminder.sentAt).toDateString() === now.toDateString();

        if (alreadySentToday) {
          continue;
        }

        try {
          // Log notification action (e.g. Email / Push dispatch)
          this.logger.log(
            `🔔 [REMINDER] Subscription "${sub.name}" ($${sub.amount}) for user ${sub.user.email} is due on ${nextBillingDate.toISOString().split('T')[0]}.`,
          );

          // Record in ReminderHistory
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
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to send reminder for subscription ${sub.id}: ${errorMessage}`,
          );

          await this.prisma.reminderHistory.create({
            data: {
              subscriptionId: sub.id,
              scheduledFor: nextBillingDate,
              status: ReminderStatus.FAILED,
              errorMessage,
            },
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
   * Get reminder history for a specific user's subscriptions.
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
}
