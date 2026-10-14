import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class UpdateSubscriptionStatusDto {
  @ApiProperty({
    description: 'Updated subscription status',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.CANCELLED,
  })
  @IsEnum(SubscriptionStatus)
  @IsNotEmpty()
  status: SubscriptionStatus;
}
