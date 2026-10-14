import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { BillingCycle } from '@prisma/client';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Name of the subscription provider or service',
    example: 'Netflix',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Cost/amount of the subscription',
    example: 15.99,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Initial or upcoming billing date (ISO 8601 string)',
    example: '2026-11-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  billingDate: string;

  @ApiProperty({
    description: 'Frequency of billing payments',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
  })
  @IsEnum(BillingCycle, {
    message: 'billingCycle must be either MONTHLY or YEARLY',
  })
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiPropertyOptional({
    description:
      'User ID who owns this subscription (can also be passed via x-user-id header)',
    example: 'user-1234',
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
