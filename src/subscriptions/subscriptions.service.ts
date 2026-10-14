import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { BillingCycle, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

export type EnrichedSubscription = Subscription & {
  nextBillingDate: Date | null;
};

export interface UploadedCsvFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to ensure the referenced user exists before creating subscriptions.
   */
  async ensureUserExists(userId: string) {
    const isEmail = userId.includes('@');
    const email = isEmail
      ? userId
      : userId === 'demo-user-id' && process.env.SMTP_USER
        ? process.env.SMTP_USER
        : `${userId}@example.com`;
    const name = isEmail ? userId.split('@')[0] : `User ${userId}`;

    return this.prisma.user.upsert({
      where: { id: userId },
      update: {
        ...(process.env.SMTP_USER &&
          userId === 'demo-user-id' && { email: process.env.SMTP_USER }),
      },
      create: {
        id: userId,
        email,
        name,
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

  /**
   * Retrieve reminder history for a specific subscription, ensuring user ownership.
   */
  async getReminders(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.reminderHistory.findMany({
      where: { subscriptionId: id },
      orderBy: { sentAt: 'desc' },
    });
  }

  /**
   * Import subscriptions from a CSV file for a given user.
   * Validates each row, imports valid rows, skips invalid ones, and returns a detailed summary.
   */
  async importFromCsv(userId: string, file?: UploadedCsvFile) {
    if (!file || !file.buffer) {
      throw new BadRequestException('A CSV file is required');
    }

    // 1. Accept only CSV files
    const isCsvExtension = file.originalname?.toLowerCase().endsWith('.csv');
    const isCsvMime =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain';

    if (!isCsvExtension && !isCsvMime) {
      throw new BadRequestException('Accept only CSV files');
    }

    await this.ensureUserExists(userId);

    // 2. Parse CSV rows
    let records: Array<Record<string, string>> = [];
    try {
      records = parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError) {
      const msg =
        parseError instanceof Error ? parseError.message : String(parseError);
      throw new BadRequestException(`Failed to parse CSV file: ${msg}`);
    }

    const totalRows = records.length;
    let imported = 0;
    let rejected = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const rowNumber = i + 1; // 1-based row index for imported rows
      const row = records[i];
      const rowErrors: string[] = [];

      // Validate name
      const name = row.name?.trim();
      if (!name) {
        rowErrors.push('Name is required');
      }

      // Validate amount
      const rawAmount =
        row.amount !== undefined ? String(row.amount).trim() : '';
      const amount = parseFloat(rawAmount);
      if (!rawAmount || isNaN(amount) || amount <= 0) {
        rowErrors.push('Amount must be greater than zero');
      }

      // Validate billingDate
      const rawDate = row.billingDate?.trim();
      const billingDate = rawDate ? new Date(rawDate) : null;
      if (!billingDate || isNaN(billingDate.getTime())) {
        rowErrors.push('Invalid billing date');
      }

      // Validate billingCycle
      const rawCycle = row.billingCycle?.trim().toUpperCase();
      let cycle: BillingCycle | null = null;
      if (
        rawCycle === BillingCycle.MONTHLY ||
        rawCycle === BillingCycle.YEARLY
      ) {
        cycle = rawCycle as BillingCycle;
      } else {
        rowErrors.push('Invalid billing cycle');
      }

      // If any validation error occurred, record it and skip saving this row
      if (rowErrors.length > 0) {
        rejected++;
        errors.push({
          row: rowNumber,
          message: rowErrors.join('; '),
        });
        continue;
      }

      // Valid row -> import into database
      try {
        await this.prisma.subscription.create({
          data: {
            name: name!,
            amount,
            billingDate: billingDate!,
            billingCycle: cycle!,
            userId,
          },
        });
        imported++;
      } catch (dbError) {
        rejected++;
        const msg =
          dbError instanceof Error ? dbError.message : String(dbError);
        errors.push({
          row: rowNumber,
          message: `Database error: ${msg}`,
        });
      }
    }

    return {
      totalRows,
      imported,
      rejected,
      errors,
    };
  }
}
