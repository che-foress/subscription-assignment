import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (defaultUserId: string = 'demo-user-id', ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const headerUserId = request.headers['x-user-id'];
    const queryUserId = request.query?.userId;
    const bodyUserId = request.body?.userId;
    return (headerUserId || queryUserId || bodyUserId || defaultUserId) as string;
  },
);
