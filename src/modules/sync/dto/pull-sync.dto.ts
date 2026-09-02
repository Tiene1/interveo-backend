import { IsISO8601, IsOptional } from 'class-validator';

export class PullSyncDto {
  /** Horodatage ISO 8601 du dernier enregistrement recu par le mobile. */
  @IsOptional()
  @IsISO8601()
  depuis?: string;
}
