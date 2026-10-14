import { Test, TestingModule } from '@nestjs/testing';
import { ReminderStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmailService } from './email.service';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  let service: RemindersService;

  const mockPrisma = {
    subscription: {
      findMany: jest.fn(),
    },
    reminderHistory: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockSubscriptionsService = {
    calculateNextBillingDate: jest.fn(),
    findOne: jest.fn(),
  };

  const mockEmailService = {
    sendReminderEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processUpcomingReminders', () => {
    it('should send email and record SUCCESS when due within 3 days', async () => {
      const now = new Date();
      const dueDate = new Date();
      dueDate.setDate(now.getDate() + 2); // 2 days ahead

      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          name: 'Spotify',
          amount: 9.99,
          billingDate: dueDate,
          billingCycle: 'MONTHLY',
          status: SubscriptionStatus.ACTIVE,
          user: { email: 'test@example.com', name: 'Tester' },
        },
      ]);

      mockSubscriptionsService.calculateNextBillingDate.mockReturnValue(dueDate);
      mockPrisma.reminderHistory.findFirst.mockResolvedValue(null); // No existing reminder
      mockEmailService.sendReminderEmail.mockResolvedValue({ messageId: 'msg-1' });
      mockPrisma.reminderHistory.create.mockResolvedValue({ id: 'rem-1' });

      const result = await service.processUpcomingReminders(3);

      expect(result.processedCount).toBe(1);
      expect(mockEmailService.sendReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subscriptionName: 'Spotify',
        }),
      );
      expect(mockPrisma.reminderHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ReminderStatus.SUCCESS,
          }),
        }),
      );
    });

    it('should prevent duplicate reminders for the same subscription and billing date', async () => {
      const now = new Date();
      const dueDate = new Date();
      dueDate.setDate(now.getDate() + 1);

      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          name: 'Spotify',
          amount: 9.99,
          billingDate: dueDate,
          billingCycle: 'MONTHLY',
          status: SubscriptionStatus.ACTIVE,
          user: { email: 'test@example.com', name: 'Tester' },
        },
      ]);

      mockSubscriptionsService.calculateNextBillingDate.mockReturnValue(dueDate);
      // Already has a SUCCESS reminder
      mockPrisma.reminderHistory.findFirst.mockResolvedValue({
        id: 'existing-rem',
        status: ReminderStatus.SUCCESS,
      });

      const result = await service.processUpcomingReminders(3);

      expect(result.processedCount).toBe(0);
      expect(mockEmailService.sendReminderEmail).not.toHaveBeenCalled();
      expect(mockPrisma.reminderHistory.create).not.toHaveBeenCalled();
    });

    it('should handle email delivery failure and record FAILED status in database', async () => {
      const now = new Date();
      const dueDate = new Date();
      dueDate.setDate(now.getDate() + 1);

      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          name: 'Spotify',
          amount: 9.99,
          billingDate: dueDate,
          billingCycle: 'MONTHLY',
          status: SubscriptionStatus.ACTIVE,
          user: { email: 'test@example.com', name: 'Tester' },
        },
      ]);

      mockSubscriptionsService.calculateNextBillingDate.mockReturnValue(dueDate);
      mockPrisma.reminderHistory.findFirst.mockResolvedValue(null);
      mockEmailService.sendReminderEmail.mockRejectedValue(
        new Error('SMTP Connection Timeout'),
      );

      const result = await service.processUpcomingReminders(3);

      expect(result.processedCount).toBe(1);
      expect(result.reminders[0].status).toBe(ReminderStatus.FAILED);
      expect(mockPrisma.reminderHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ReminderStatus.FAILED,
            errorMessage: 'SMTP Connection Timeout',
          }),
        }),
      );
    });
  });
});
