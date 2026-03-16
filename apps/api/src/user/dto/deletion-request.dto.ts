import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateDeletionRequestDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}

export class ReviewDeletionRequestDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reviewNotes?: string;
}