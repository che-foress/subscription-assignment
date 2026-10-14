import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EmailService } from './email.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [RemindersController],
  providers: [RemindersService, EmailService],
  exports: [RemindersService, EmailService],
})
export class RemindersModule {}
