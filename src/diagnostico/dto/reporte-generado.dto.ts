import { ApiProperty } from '@nestjs/swagger';

export type PrioridadOportunidad = 'alta' | 'media' | 'baja';

export class OportunidadDto {
  @ApiProperty({ example: 'Digitalización de registros de EPP' })
  titulo!: string;

  @ApiProperty({
    example:
      'Reemplazar el registro en papel por captura en tableta con firma biométrica.',
    description: '1-2 frases — resumen corto para mostrar en la tablet',
  })
  descripcion!: string;

  @ApiProperty({ example: '6-9 horas/semana' })
  ahorroEstimadoHorasSemana!: string;

  @ApiProperty({ enum: ['alta', 'media', 'baja'], example: 'alta' })
  prioridad!: PrioridadOportunidad;
}

export class ReporteGeneradoDto {
  @ApiProperty({ example: true })
  exito!: boolean;

  @ApiProperty({ example: 'Reporte generado y enviado exitosamente a su correo.' })
  mensaje!: string;

  @ApiProperty({
    type: [OportunidadDto],
    description: 'Las 3 oportunidades principales para mostrar en la tablet',
  })
  oportunidades!: OportunidadDto[];

  @ApiProperty({ example: true })
  correoEnviado!: boolean;
}
