import { Equals, IsISO8601, IsNotEmpty, IsString, IsUUID } from 'class-validator';

/** Une cloture d'intervention envoyee par le mobile lors de la synchronisation. */
export class ClotureItemDto {
  @IsUUID()
  idServeur!: string;

  @IsString()
  @IsNotEmpty()
  problemeConstate!: string;

  @IsString()
  @IsNotEmpty()
  travauxRealises!: string;

  @Equals('REALISEE')
  statut!: 'REALISEE';

  @IsISO8601()
  dateRealisation!: string;
}
