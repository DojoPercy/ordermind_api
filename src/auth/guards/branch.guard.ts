import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { UserRole } from '../enums/user-role.enum';
import { UserPayload } from '../interfaces';

@Injectable()
export class BranchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserPayload;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Owners have access to all branches
    if (user.role === UserRole.OWNER) {
      return true;
    }

    // Get branchId from params, query, or header
    const branchId =
      request.params?.branchId ||
      request.query?.branchId ||
      request.headers['x-branch-id'];

    if (!branchId) {
      throw new BadRequestException(
        'Branch ID is required (params, query, or X-Branch-Id header)',
      );
    }

    // Check if user has access to this branch
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    return true;
  }
}
