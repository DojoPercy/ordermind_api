import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, BadRequestException } from '@nestjs/common';

export const CurrentBranch = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();

    // Try to get branchId from params, query, or header
    const branchId =
      request.params?.branchId ??
      request.query?.branchId ??
      request.headers['x-branch-id'];

    if (!branchId) {
      throw new BadRequestException(
        'Branch ID is required (params, query, or X-Branch-Id header)',
      );
    }

    return branchId;
  },
);
