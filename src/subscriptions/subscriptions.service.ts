import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingCycle, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

export type EnrichedSubscription = Subscription & {
  nextBillingDate: Date | null;
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to ensure the referenced user exists before creating subscriptions.
   */
  async ensureUserExists(userId: string) {
    return this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@example.com`,
        name: `User ${userId}`,
      },
    });
  }

  /**
   * Calculates the upcoming next billing date given an initial billing date and cycle.
   */
  calculateNextBillingDate(
    billingDate: Date,
    cycle: BillingCycle,
    referenceDate: Date = new Date(),
  ): Date {
    const next = new Date(billingDate);
    if (isNaN(next.getTime())) {
      return new Date();
    }

    if (next > referenceDate) {
      return next;
    }

    // Advance cycle until next billing date is in the future
    while (next <= referenceDate) {
      if (cycle === BillingCycle.MONTHLY) {
        next.setMonth(next.getMonth() + 1);
      } else if (cycle === BillingCycle.YEARLY) {
        next.setFullYear(next.getFullYear() + 1);
      } else {
        break;
      }
    }

    return next;
  }

  /**
   * Attaches the dynamically calculated next billing date to the subscription model.
   */
  private enrich(subscription: Subscription): EnrichedSubscription {
    const nextBillingDate =
      subscription.status === SubscriptionStatus.ACTIVE
        ? this.calculateNextBillingDate(
            subscription.billingDate,
            subscription.billingCycle,
          )
        : null;

    return {
      ...subscription,
      nextBillingDate,
    };
  }

  /**
   * Create a new subscription for a given user.
   */
  async create(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<EnrichedSubscription> {
    const ownerId = dto.userId || userId;
    await this.ensureUserExists(ownerId);

    const subscription = await this.prisma.subscription.create({
      data: {
        name: dto.name,
        amount: dto.amount,
        billingDate: new Date(dto.billingDate),
        billingCycle: dto.billingCycle,
        userId: ownerId,
      },
    });

    return this.enrich(subscription);
  }

  /**
   * Find all subscriptions belonging to the current user, optionally filtered by status.
   */
  async findAll(
    userId: string,
    status?: SubscriptionStatus,
  ): Promise<EnrichedSubscription[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: {
        billingDate: 'asc',
      },
    });

    return subscriptions.map((sub) => this.enrich(sub));
  }

  /**
   * Convenience method to fetch only active subscriptions for the user.
   */
  async findActive(userId: string): Promise<EnrichedSubscription[]> {
    return this.findAll(userId, SubscriptionStatus.ACTIVE);
  }

  /**
   * Find a specific subscription by ID, ensuring user ownership.
   */
  async findOne(userId: string, id: string): Promise<EnrichedSubscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        reminders: {
          orderBy: { sentAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(
        `Subscription with ID "${id}" was not found or does not belong to this user`,
      );
    }

    return this.enrich(subscription);
  }

  /**
   * Update an existing subscription, ensuring user ownership.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateSubscriptionDto,
  ): Promise<EnrichedSubscription> {
    // Verify ownership
    await this.findOne(userId, id);

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.billingDate ? { billingDate: new Date(dto.billingDate) } : {}),
        ...(dto.billingCycle ? { billingCycle: dto.billingCycle } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    return this.enrich(updated);
  }

  /**
   * Update the status of a subscription (e.g. CANCELLED or ACTIVE).
   */
  async updateStatus(
    userId: string,
    id: string,
    status: SubscriptionStatus,
  ): Promise<EnrichedSubscription> {
    await this.findOne(userId, id);

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { status },
    });

    return this.enrich(updated);
  }

  /**
   * Delete a subscription, ensuring user ownership.
   */
  async remove(userId: string, id: string): Promise<{ deleted: boolean; id: string }> {
    await this.findOne(userId, id);

    await this.prisma.subscription.delete({
      where: { id },
    });

    return { deleted: true, id };
  }
}
