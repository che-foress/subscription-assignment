import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserId } from '../common/decorators/user-id.decorator';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { QuerySubscriptionDto } from './dto/query-subscription.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-status.dto';
import { SubscriptionsService } from './subscriptions.service';
import type { UploadedCsvFile } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiHeader({
  name: 'x-user-id',
  required: false,
  description:
    'User ID to scope subscriptions. Defaults to "demo-user-id" if omitted.',
})
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Import subscriptions from a CSV file',
    description:
      'Uploads a CSV file with columns: name,amount,billingDate,billingCycle. Valid rows are imported; invalid rows are reported with row index and error message.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'CSV file containing name, amount, billingDate, billingCycle',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Summary of imported vs rejected subscriptions with row-level error details.',
  })
  @ApiResponse({
    status: 400,
    description: 'Accept only CSV files or invalid file format.',
  })
  @UseInterceptors(FileInterceptor('file'))
  importSubscriptions(
    @UserId() userId: string,
    @UploadedFile() file: UploadedCsvFile,
  ) {
    return this.subscriptionsService.importFromCsv(userId, file);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully with calculated next billing date.',
  })
  create(
    @UserId() userId: string,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.create(userId, createSubscriptionDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Retrieve subscriptions for the current user (optionally filtered by status)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of subscriptions enriched with calculated next billing date.',
  })
  findAll(
    @UserId() userId: string,
    @Query() query: QuerySubscriptionDto,
  ) {
    return this.subscriptionsService.findAll(userId, query.status);
  }

  @Get('active')
  @ApiOperation({ summary: 'Retrieve all active subscriptions for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of active subscriptions.',
  })
  findActive(@UserId() userId: string) {
    return this.subscriptionsService.findActive(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific subscription by ID' })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, description: 'Subscription details.' })
  @ApiResponse({ status: 404, description: 'Subscription not found for this user.' })
  findOne(@UserId() userId: string, @Param('id') id: string) {
    return this.subscriptionsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subscription' })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, description: 'Updated subscription.' })
  @ApiResponse({ status: 404, description: 'Subscription not found for this user.' })
  update(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.update(userId, id, updateSubscriptionDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update only the subscription status (e.g. cancel)' })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, description: 'Subscription status updated.' })
  updateStatus(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateSubscriptionStatusDto,
  ) {
    return this.subscriptionsService.updateStatus(userId, id, updateStatusDto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription' })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, description: 'Subscription deleted.' })
  remove(@UserId() userId: string, @Param('id') id: string) {
    return this.subscriptionsService.remove(userId, id);
  }

  @Get(':id/reminders')
  @ApiOperation({
    summary: 'Get reminder history for a specific subscription',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of reminder logs for this subscription.',
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found for this user.',
  })
  getReminders(@UserId() userId: string, @Param('id') id: string) {
    return this.subscriptionsService.getReminders(userId, id);
  }
}
