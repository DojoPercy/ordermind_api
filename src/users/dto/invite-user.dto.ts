import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsUUID } from 'class-validator';

import { UserRole } from '../../auth/enums/user-role.enum';

export class InviteUserDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'waiter@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Role to assign to the invited user',
    enum: UserRole,
    example: UserRole.WAITER,
    enumName: 'UserRole',
  })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({
    description: 'Branch UUID to assign the user to',
    example: 'a3da02a2-dfed-415e-bd85-f6e6135d9c51',
  })
  @IsUUID()
  branchId!: string;
}
