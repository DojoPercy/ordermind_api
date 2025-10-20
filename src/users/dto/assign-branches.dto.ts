import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignBranchesDto {
  @ApiProperty({
    description: 'Array of branch UUIDs to assign to the user',
    type: [String],
    example: [
      'a3da02a2-dfed-415e-bd85-f6e6135d9c51',
      'b4eb13b3-efee-526f-c96-g7f7246e2d62',
    ],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds!: string[];
}
