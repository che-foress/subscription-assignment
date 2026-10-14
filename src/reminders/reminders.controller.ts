import { Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiHeader({
  name: 'x-user-id',
  required: false,
  description:
    'User ID to scope reminder history. Defaults to "demo-user-id" if omitted.',
})
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get payment reminder history for current user subscriptions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of past reminder attempts with statuses and timestamps.',
  })
  getHistory(@UserId() userId: string) {
    return this.remindersService.getHistoryForUser(userId);
  }

  @Post('trigger')
  @ApiOperation({
    summary:
      'Manually trigger the reminder scan job for subscriptions due soon',
  })
  @ApiQuery({
    name: 'daysAhead',
    required: false,
    type: Number,
    description:
      'Lookahead window in days to detect upcoming payments (default: 3)',
  })
  @ApiResponse({
    status: 201,
    description: 'Summary of dispatched reminders and recorded logs.',
  })
  triggerReminders(@Query('daysAhead') daysAhead?: number) {
    return this.remindersService.processUpcomingReminders(
      daysAhead ? Number(daysAhead) : 3,
    );
  }
}
