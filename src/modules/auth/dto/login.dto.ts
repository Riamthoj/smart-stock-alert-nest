import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john', minLength: 1, maxLength: 64 })
  @IsString()
  @Length(1, 64)
  username!: string;

  @ApiProperty({ example: 'password123', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password!: string;
}
