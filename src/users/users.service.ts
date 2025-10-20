import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserRole } from '../auth/enums/user-role.enum';
import { Auth0ManagementService } from '../auth/services/auth0-management.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginationService } from '../common/services/pagination.service';
import { PrismaService } from '../database/prisma.service';

import { InviteUserDto, AssignBranchesDto } from './dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly auth0ManagementService: Auth0ManagementService,
    private readonly configService: ConfigService,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Invite a user to the organization and assign to a branch
   */
  async inviteUser(
    inviteUserDto: InviteUserDto,
    organizationId: string,
    inviterName: string,
    inviterRole: UserRole,
  ) {
    const { email, role, branchId } = inviteUserDto;
    const startTime = Date.now();

    this.logger.log('Invitation flow started', {
      email,
      role,
      branchId,
      inviterName,
      inviterRole,
      timestamp: new Date().toISOString(),
    });

    // Validate permissions: Managers can only invite Waiters and Chefs
    if (inviterRole === UserRole.MANAGER) {
      if (role !== UserRole.WAITER && role !== UserRole.CHEF) {
        throw new ForbiddenException(
          'Managers can only invite Waiters and Chefs',
        );
      }
    }

    // Get organization
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Verify branch exists and belongs to organization
    const branch = await this.prismaService.branch.findFirst({
      where: {
        id: branchId,
        organizationId: organization.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check for existing invitation or user
    const existingUser = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(`User with email ${email} already exists`);
    }

    const existingInvitation = await this.prismaService.invitation.findFirst({
      where: {
        email,
        organizationId: organization.id,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        `Pending invitation already exists for ${email}`,
      );
    }

    // Get role ID from config
    const roleIdMap = {
      [UserRole.OWNER]: this.configService.get<string>('app.auth0.roles.owner'),
      [UserRole.MANAGER]: this.configService.get<string>(
        'app.auth0.roles.manager',
      ),
      [UserRole.WAITER]: this.configService.get<string>(
        'app.auth0.roles.waiter',
      ),
      [UserRole.CHEF]: this.configService.get<string>('app.auth0.roles.chef'),
    };

    const roleId = roleIdMap[role];

    if (!roleId) {
      throw new BadRequestException('Invalid role');
    }

    // Create invitation in Auth0
    this.logger.log('Creating Auth0 invitation', {
      organizationId,
      email,
      roleId,
    });

    const invitation = await this.auth0ManagementService.createInvitation(
      organizationId,
      email,
      inviterName,
      roleId,
    );

    this.logger.log('Auth0 invitation created', {
      invitationId: invitation.id,
      email,
      duration: Date.now() - startTime,
    });

    // Store invitation in database
    const dbInvitation = await this.prismaService.invitation.create({
      data: {
        auth0InvitationId: invitation.id,
        email: email,
        role: role,
        organizationId: organization.id,
        branchId: branchId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    this.logger.log('Invitation saved to database', {
      dbInvitationId: dbInvitation.id,
      auth0InvitationId: invitation.id,
      email,
      role,
      branchId,
      expiresAt: dbInvitation.expiresAt,
    });

    this.logger.log(
      `Invitation created for ${email} to join ${organization.name}`,
    );

    return {
      invitationId: dbInvitation.id,
      invitationUrl: invitation.ticket_url,
      expiresAt: dbInvitation.expiresAt,
    };
  }

  /**
   * Get all members of the organization with their branch assignments
   */
  async getOrganizationMembers(
    organizationId: string,
    paginationQuery: PaginationQueryDto,
  ) {
    const { limit = 20, cursor, orderBy = 'desc' } = paginationQuery;

    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Decode cursor if provided
    let cursorCondition = {};
    if (cursor) {
      const decodedCursor = this.paginationService.decodeCursor(cursor);
      if (decodedCursor) {
        cursorCondition = {
          id:
            orderBy === 'desc'
              ? { lt: decodedCursor.id }
              : { gt: decodedCursor.id },
        };
      }
    }

    // Fetch limit + 1 to determine if there's a next page
    const users = await this.prismaService.user.findMany({
      where: {
        organizationId: organization.id,
        ...cursorCondition,
      },
      include: {
        branches: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: orderBy },
      take: limit + 1,
    });

    const mappedUsers = users.map((user) => ({
      id: user.id,
      auth0UserId: user.auth0UserId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      profilePicture: user.profilePicture,
      role: user.role,
      branches: user.branches.map((ub) => ub.branch),
      createdAt: user.createdAt,
    }));

    return this.paginationService.buildPaginatedResponse(
      mappedUsers,
      limit,
      'id',
      ['createdAt'],
    );
  }

  /**
   * Assign or remove branches for a user
   */
  async updateUserBranches(
    userId: string,
    assignBranchesDto: AssignBranchesDto,
    organizationId: string,
    updaterRole: UserRole,
  ) {
    // Only Owners and Managers can update branch assignments
    if (updaterRole !== UserRole.OWNER && updaterRole !== UserRole.MANAGER) {
      throw new ForbiddenException(
        'Only Owners and Managers can update branch assignments',
      );
    }

    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Get user
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        organizationId: organization.id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate all branches belong to organization
    const branches = await this.prismaService.branch.findMany({
      where: {
        id: { in: assignBranchesDto.branchIds },
        organizationId: organization.id,
      },
    });

    if (branches.length !== assignBranchesDto.branchIds.length) {
      throw new BadRequestException(
        'One or more branches do not exist or do not belong to your organization',
      );
    }

    // Delete existing branch assignments
    await this.prismaService.userBranch.deleteMany({
      where: { userId: user.id },
    });

    // Create new branch assignments
    const userBranches = assignBranchesDto.branchIds.map((branchId) => ({
      userId: user.id,
      branchId,
    }));

    await this.prismaService.userBranch.createMany({
      data: userBranches,
    });

    this.logger.log(`Updated branch assignments for user ${userId}`);

    return {
      userId: user.id,
      branchIds: assignBranchesDto.branchIds,
    };
  }

  /**
   * Get user's branch assignments by database ID
   * Users can view their own assignments, Owners/Managers can view any user's assignments
   */
  async getUserBranches(
    userId: string,
    organizationId: string,
    requesterAuth0Id: string,
    requesterRole: UserRole,
  ) {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Get the target user
    const targetUser = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        organizationId: organization.id,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check permissions: Users can only view their own assignments unless they're Owner/Manager
    if (
      requesterRole !== UserRole.OWNER &&
      requesterRole !== UserRole.MANAGER
    ) {
      if (targetUser.auth0UserId !== requesterAuth0Id) {
        throw new ForbiddenException(
          'You can only view your own branch assignments',
        );
      }
    }

    // Get user's branch assignments
    const userBranches = await this.prismaService.userBranch.findMany({
      where: { userId: targetUser.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      userId: targetUser.id,
      userEmail: targetUser.email,
      userName: targetUser.name,
      userRole: targetUser.role,
      branches: userBranches.map((ub) => ({
        ...ub.branch,
        assignedAt: ub.createdAt,
      })),
    };
  }

  /**
   * Get current user's branch assignments
   */
  async getCurrentUserBranches(auth0UserId: string, organizationId: string) {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const user = await this.prismaService.user.findUnique({
      where: { auth0UserId },
    });

    if (!user || user.organizationId !== organization.id) {
      throw new NotFoundException('User not found in this organization');
    }

    // Get user's branch assignments
    const userBranches = await this.prismaService.userBranch.findMany({
      where: { userId: user.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      branches: userBranches.map((ub) => ({
        ...ub.branch,
        assignedAt: ub.createdAt,
      })),
    };
  }

  /**
   * Get user's branch assignments by Auth0 ID
   * Owners and Managers can view any user's assignments using Auth0 ID
   */
  async getUserBranchesByAuth0Id(auth0UserId: string, organizationId: string) {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const user = await this.prismaService.user.findFirst({
      where: {
        auth0UserId,
        organizationId: organization.id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    // Get user's branch assignments
    const userBranches = await this.prismaService.userBranch.findMany({
      where: { userId: user.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      userId: user.id,
      auth0UserId: user.auth0UserId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      branches: userBranches.map((ub) => ({
        ...ub.branch,
        assignedAt: ub.createdAt,
      })),
    };
  }

  /**
   * Get pending invitations for the organization
   */
  async getPendingInvitations(
    organizationId: string,
    paginationQuery: PaginationQueryDto,
  ) {
    const { limit = 20, cursor, orderBy = 'desc' } = paginationQuery;

    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    let cursorCondition = {};
    if (cursor) {
      const decodedCursor = this.paginationService.decodeCursor(cursor);
      if (decodedCursor) {
        cursorCondition = {
          id:
            orderBy === 'desc'
              ? { lt: decodedCursor.id }
              : { gt: decodedCursor.id },
        };
      }
    }

    const invitations = await this.prismaService.invitation.findMany({
      where: {
        organizationId: organization.id,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(), // Only show non-expired
        },
        ...cursorCondition,
      },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: orderBy },
      take: limit + 1,
    });

    const mappedInvitations = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      branchName: inv.branch.name,
      branchId: inv.branchId,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      status: inv.status,
    }));

    return this.paginationService.buildPaginatedResponse(
      mappedInvitations,
      limit ?? 20,
      'id',
      ['createdAt'],
    );
  }

  /**
   * Remove a user from the organization
   */
  async removeUser(
    userId: string,
    organizationId: string,
    removerRole: UserRole,
    removerAuth0Id: string,
  ) {
    // Only Owners can remove users
    if (removerRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only Owners can remove users');
    }

    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        organizationId: organization.id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent self-removal
    if (user.auth0UserId === removerAuth0Id) {
      throw new BadRequestException('You cannot remove yourself');
    }

    // Remove from Auth0 organization
    await this.auth0ManagementService.removeMemberFromOrganization(
      organizationId,
      user.auth0UserId,
    );

    // Delete from our database (cascades to UserBranch)
    await this.prismaService.user.delete({
      where: { id: user.id },
    });

    this.logger.log(
      `Removed user ${userId} from organization ${organizationId}`,
    );

    return { message: 'User removed successfully' };
  }
}
