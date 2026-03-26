import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateAnnouncementDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsString()
    @IsOptional()
    @IsIn(['ANNOUNCEMENT', 'URGENT', 'SYSTEM'])
    type?: string;
}

export class UpdateAnnouncementStatusDto {
    @IsString()
    @IsIn(['active', 'inactive'])
    status: string;
}
