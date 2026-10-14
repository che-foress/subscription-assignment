import { Test, TestingModule } from '@nestjs/testing';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const mockPrisma = {
    user: {
      upsert: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateNextBillingDate', () => {
    it('should return initial billing date if it is in the future', () => {
      const futureDate = new Date('2026-12-01T00:00:00.000Z');
      const refDate = new Date('2026-10-14T00:00:00.000Z');

      const next = service.calculateNextBillingDate(
        futureDate,
        BillingCycle.MONTHLY,
        refDate,
      );
      expect(next.toISOString()).toBe(futureDate.toISOString());
    });

    it('should advance monthly billing dates until in the future', () => {
      const pastDate = new Date('2026-08-15T00:00:00.000Z');
      const refDate = new Date('2026-10-14T00:00:00.000Z');

      const next = service.calculateNextBillingDate(
        pastDate,
        BillingCycle.MONTHLY,
        refDate,
      );
      // Started Aug 15 -> Sep 15 -> Oct 15
      expect(next.getDate()).toBe(15);
      expect(next.getMonth()).toBe(9); // October is index 9
      expect(next.getFullYear()).toBe(2026);
    });

    it('should advance yearly billing dates until in the future', () => {
      const pastDate = new Date('2024-05-20T00:00:00.000Z');
      const refDate = new Date('2026-10-14T00:00:00.000Z');

      const next = service.calculateNextBillingDate(
        pastDate,
        BillingCycle.YEARLY,
        refDate,
      );
      expect(next.getFullYear()).toBe(2027);
      expect(next.getMonth()).toBe(4); // May
      expect(next.getDate()).toBe(20);
    });
  });

  describe('create', () => {
    it('should create a subscription and enrich with nextBillingDate', async () => {
      mockPrisma.user.upsert.mockResolvedValue({ id: 'user-1' });
      mockPrisma.subscription.create.mockResolvedValue({
        id: 'sub-1',
        name: 'Netflix',
        amount: 15.99,
        billingDate: new Date('2026-11-01T00:00:00.000Z'),
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create('user-1', {
        name: 'Netflix',
        amount: 15.99,
        billingDate: '2026-11-01T00:00:00.000Z',
        billingCycle: BillingCycle.MONTHLY,
      });

      expect(result.id).toBe('sub-1');
      expect(result.nextBillingDate).toBeDefined();
      expect(mockPrisma.subscription.create).toHaveBeenCalled();
    });
  });

  describe('importFromCsv', () => {
    it('should reject non-CSV files with BadRequestException', async () => {
      const mockPdfFile = {
        originalname: 'subscriptions.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('dummy data'),
      } as Express.Multer.File;

      await expect(
        service.importFromCsv('user-1', mockPdfFile),
      ).rejects.toThrow('Accept only CSV files');
    });

    it('should parse, import valid rows, skip invalid rows, and report errors', async () => {
      mockPrisma.user.upsert.mockResolvedValue({ id: 'user-1' });
      mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-created' });

      const csvContent =
        'name,amount,billingDate,billingCycle\n' +
        'Netflix,15.99,2026-10-15,MONTHLY\n' +
        'Spotify,9.99,2026-10-18,MONTHLY\n' +
        'iCloud,-2.00,2026-10-20,MONTHLY\n' +
        'Amazon Prime,139.00,2026-11-01,YEARLY\n' +
        'Gym Plan,50.00,2026-10-22,DAILY';

      const mockCsvFile = {
        originalname: 'subscriptions.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const summary = await service.importFromCsv('user-1', mockCsvFile);

      expect(summary.totalRows).toBe(5);
      expect(summary.imported).toBe(3);
      expect(summary.rejected).toBe(2);
      expect(summary.errors).toEqual([
        {
          row: 3,
          message: 'Amount must be greater than zero',
        },
        {
          row: 5,
          message: 'Invalid billing cycle',
        },
      ]);
      expect(mockPrisma.subscription.create).toHaveBeenCalledTimes(3);
    });
  });
});
