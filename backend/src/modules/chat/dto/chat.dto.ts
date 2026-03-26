import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
    @ApiProperty({ description: 'The ID of the employee receiving the message' })
    @IsString()
    @IsNotEmpty()
    receiverId: string;

    @ApiProperty({ description: 'The plain text content of the message' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(10000)
    content: string;
}
