import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagementClient } from 'auth0';

@Injectable()
export class Auth0ManagementService {
  private readonly managementClient: ManagementClient;
  private readonly logger = new Logger(Auth0ManagementService.name);

  constructor(private readonly configService: ConfigService) {
    // Use tenant domain for Management API (custom domains don't support it)
    const domain = this.configService.get<string>('app.auth0.tenantDomain');
    const clientId = this.configService.get<string>(
      'app.auth0.management.clientId',
    );
    const clientSecret = this.configService.get<string>(
      'app.auth0.management.clientSecret',
    );

    if (!domain || !clientId || !clientSecret) {
      throw new Error('Missing required Auth0 configuration');
    }

    this.managementClient = new ManagementClient({
      domain,
      clientId,
      clientSecret,
    });
  }

  /**
   * Create an Auth0 organization
   */
  async createOrganization(name: string, displayName: string): Promise<string> {
    try {
      const organization = await this.managementClient.organizations.create({
        name,
        display_name: displayName,
      });

      if (!organization.id) {
        throw new Error('Organization creation failed: no ID returned');
      }

      this.logger.log(`Created organization: ${organization.id}`);
      return organization.id;
    } catch (error) {
      this.logger.error('Failed to create organization', error);
      throw error;
    }
  }

  /**
   * Add user as member to organization
   */
  async addMemberToOrganization(orgId: string, userId: string): Promise<void> {
    try {
      await this.managementClient.organizations.members.create(orgId, {
        members: [userId],
      });

      this.logger.log(`Added user ${userId} to organization ${orgId}`);
    } catch (error) {
      this.logger.error('Failed to add member to organization', error);
      throw error;
    }
  }

  /**
   * Assign role to user within organization
   */
  async assignRoleToUser(
    orgId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    try {
      await this.managementClient.organizations.members.roles.assign(
        orgId,
        userId,
        { roles: [roleId] },
      );

      this.logger.log(
        `Assigned role ${roleId} to user ${userId} in org ${orgId}`,
      );
    } catch (error) {
      this.logger.error('Failed to assign role to user', error);
      throw error;
    }
  }

  /**
   * Create invitation to join organization
   */
  async createInvitation(
    orgId: string,
    inviteeEmail: string,
    inviterName: string,
    roleId?: string,
  ): Promise<{ id: string; ticket_url: string }> {
    try {
      const clientId = this.configService.get<string>(
        'app.auth0.management.clientId',
      );

      if (!clientId) {
        throw new Error('Missing Auth0 client ID configuration');
      }

      const invitationData: {
        invitee: { email: string };
        inviter: { name: string };
        client_id: string;
        roles?: string[];
      } = {
        invitee: { email: inviteeEmail },
        inviter: { name: inviterName },
        client_id: clientId,
      };

      if (roleId) {
        invitationData.roles = [roleId];
      }

      const invitation =
        await this.managementClient.organizations.invitations.create(
          orgId,
          invitationData,
        );

      this.logger.log(`Created invitation for ${inviteeEmail} to org ${orgId}`);

      if (!invitation.id || !invitation.invitation_url) {
        throw new Error('Invitation creation failed: missing required fields');
      }

      return {
        id: invitation.id,
        ticket_url: invitation.invitation_url,
      };
    } catch (error) {
      this.logger.error('Failed to create invitation', error);
      throw error;
    }
  }

  /**
   * Revoke organization invitation
   */
  async revokeInvitation(orgId: string, invitationId: string): Promise<void> {
    try {
      await this.managementClient.organizations.invitations.delete(
        orgId,
        invitationId,
      );

      this.logger.log(`Revoked invitation ${invitationId} for org ${orgId}`);
    } catch (error) {
      this.logger.error('Failed to revoke invitation', error);
      throw error;
    }
  }

  /**
   * Remove user from organization
   */
  async removeMemberFromOrganization(
    orgId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.managementClient.organizations.members.delete(orgId, {
        members: [userId],
      });

      this.logger.log(`Removed user ${userId} from organization ${orgId}`);
    } catch (error) {
      this.logger.error('Failed to remove member from organization', error);
      throw error;
    }
  }

  /**
   * Update user role in organization
   */
  async updateUserRole(
    orgId: string,
    userId: string,
    newRoleId: string,
  ): Promise<void> {
    try {
      // First, get current roles
      const currentRoles = [];
      const rolesPage =
        await this.managementClient.organizations.members.roles.list(
          orgId,
          userId,
        );

      for await (const role of rolesPage) {
        currentRoles.push(role);
      }

      // Remove existing roles
      if (currentRoles.length > 0) {
        const roleIds = currentRoles
          .map((r) => r.id)
          .filter((id): id is string => id !== undefined);

        if (roleIds.length > 0) {
          await this.managementClient.organizations.members.roles.delete(
            orgId,
            userId,
            { roles: roleIds },
          );
        }
      }

      // Assign new role
      await this.managementClient.organizations.members.roles.assign(
        orgId,
        userId,
        { roles: [newRoleId] },
      );

      this.logger.log(
        `Updated role for user ${userId} in org ${orgId} to ${newRoleId}`,
      );
    } catch (error) {
      this.logger.error('Failed to update user role', error);
      throw error;
    }
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(
    userId: string,
  ): Promise<Array<{ id: string; name: string; display_name: string }>> {
    try {
      const organizations = [];
      const orgsPage =
        await this.managementClient.users.organizations.list(userId);

      for await (const org of orgsPage) {
        if (org.id && org.name && org.display_name) {
          organizations.push({
            id: org.id,
            name: org.name,
            display_name: org.display_name,
          });
        }
      }

      return organizations;
    } catch (error) {
      this.logger.error('Failed to get user organizations', error);
      throw error;
    }
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(orgId: string): Promise<
    Array<{
      user_id: string;
      email: string;
      name?: string;
      picture?: string;
    }>
  > {
    try {
      const members = [];
      const membersPage =
        await this.managementClient.organizations.members.list(orgId);

      for await (const member of membersPage) {
        if (member.user_id && member.email) {
          members.push({
            user_id: member.user_id,
            email: member.email,
            ...(member.name && { name: member.name }),
            ...(member.picture && { picture: member.picture }),
          });
        }
      }

      return members;
    } catch (error) {
      this.logger.error('Failed to get organization members', error);
      throw error;
    }
  }

  /**
   * Get user's roles in organization
   */
  async getUserRolesInOrganization(
    orgId: string,
    userId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    try {
      const roles = [];
      const rolesPage =
        await this.managementClient.organizations.members.roles.list(
          orgId,
          userId,
        );

      for await (const role of rolesPage) {
        if (role.id && role.name) {
          roles.push({
            id: role.id,
            name: role.name,
          });
        }
      }

      return roles;
    } catch (error) {
      this.logger.error('Failed to get user roles', error);
      throw error;
    }
  }
}
