import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../enums/user-role.enum';
import { Auth0JwtPayload, UserPayload } from '../interfaces';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
  private readonly logger = new Logger(Auth0Strategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    const audience = configService.get<string>('app.auth0.audience');
    const issuer = configService.get<string>('app.auth0.issuerUrl');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuer?.replace(/\/$/, '')}/.well-known/jwks.json`,
      }),
    });

    this.logger.debug('Auth0 Strategy Configuration:', {
      audience,
      issuer,
      jwksUri: `${issuer?.replace(/\/$/, '')}/.well-known/jwks.json`,
    });
  }

  async validate(payload: Auth0JwtPayload): Promise<UserPayload> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Extract custom claims
    const claimsNamespace = this.configService.get<string>(
      'app.auth0.customClaimsNamespace',
    );

    const orgId = (payload.org_id ?? payload[`${claimsNamespace}/org_id`]) as
      | string
      | undefined;
    // Convert string role to enum
    const roleString = payload[`${claimsNamespace}/role`] as string;
    const role = roleString
      ? this.convertStringToRole(roleString)
      : UserRole.OWNER;
    const branchIds =
      (payload[`${claimsNamespace}/branch_ids`] as string[]) ?? [];

    // Extract email and name from custom claims or standard claims
    const email =
      payload.email ??
      (payload[`${claimsNamespace}/email`] as string | undefined);
    const name =
      payload.name ??
      (payload[`${claimsNamespace}/name`] as string | undefined);

    // Allow users without organization (for org creation flow)
    // Sync user to database if organization exists
    if (orgId) {
      await this.syncUserToDatabase(payload.sub, email, orgId, role);
    }

    return {
      auth0Id: payload.sub,
      email: email || '',
      ...(name && { name }),
      ...(orgId && { organizationId: orgId }),
      role,
      branchIds,
    };
  }

  private async syncUserToDatabase(
    auth0UserId: string,
    email: string | undefined,
    organizationId: string,
    role: UserRole,
  ): Promise<void> {
    try {
      this.logger.log('JIT provisioning started', {
        auth0UserId,
        email,
        organizationId,
        role,
      });

      // Check if organization exists in our database
      const organization = await this.prismaService.organization.findUnique({
        where: { auth0OrgId: organizationId },
      });

      if (!organization) {
        // Organization doesn't exist yet in our DB
        // This is expected during org creation flow
        this.logger.warn(
          `Organization ${organizationId} not found in database`,
        );
        return;
      }

      // Check for pending invitation
      const pendingInvitation = await this.prismaService.invitation.findFirst({
        where: {
          ...(email && { email }),
          organizationId: organization.id,
          status: 'PENDING',
        },
        include: {
          branch: true,
        },
      });

      if (pendingInvitation) {
        this.logger.log('Pending invitation found during login', {
          invitationId: pendingInvitation.id,
          email: pendingInvitation.email,
          role: pendingInvitation.role,
          branchId: pendingInvitation.branchId,
          branchName: pendingInvitation.branch.name,
        });
      }

      // Use invitation role if exists, otherwise use role from JWT
      const finalRole = pendingInvitation?.role || role;

      // Upsert user
      const user = await this.prismaService.user.upsert({
        where: { auth0UserId },
        create: {
          auth0UserId,
          email: email || '',
          role: finalRole,
          organizationId: organization.id,
        },
        update: {
          ...(email && { email }),
          role: finalRole,
        },
      });

      // Auto-assign branch if invitation exists
      if (pendingInvitation) {
        await this.prismaService.userBranch.upsert({
          where: {
            userId_branchId: {
              userId: user.id,
              branchId: pendingInvitation.branchId,
            },
          },
          create: {
            userId: user.id,
            branchId: pendingInvitation.branchId,
          },
          update: {},
        });

        // Mark invitation as accepted
        await this.prismaService.invitation.update({
          where: { id: pendingInvitation.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });

        this.logger.log('JIT provisioning completed with invitation', {
          userId: user.id,
          role: finalRole,
          branchAssigned: true,
          branchName: pendingInvitation.branch.name,
          invitationId: pendingInvitation.id,
        });
      } else {
        this.logger.log('JIT provisioning completed without invitation', {
          userId: user.id,
          role: finalRole,
          branchAssigned: false,
        });
      }
    } catch (error) {
      // Log error but don't fail authentication
      this.logger.error('Failed to sync user to database', {
        auth0UserId,
        email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private convertStringToRole(roleString: string): UserRole {
    switch (roleString.toLowerCase()) {
      case 'owner':
        return UserRole.OWNER;
      case 'manager':
        return UserRole.MANAGER;
      case 'waiter':
        return UserRole.WAITER;
      case 'chef':
        return UserRole.CHEF;
      default:
        this.logger.warn(`Unknown role: ${roleString}, defaulting to OWNER`);
        return UserRole.OWNER;
    }
  }
}
