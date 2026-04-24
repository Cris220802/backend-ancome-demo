import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RespuestasDto {
  @ApiProperty({
    description: 'Rol del visitante en su empresa',
    example: 'Contratista minero',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q1_rol_empresa!: string;

  @ApiProperty({
    description: 'Tamaño de la operación (rango de personal)',
    example: '30-80 personas',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q2_tamano_operacion!: string;

  @ApiProperty({
    description: 'Qué automatizaría mañana si pudiera',
    example: 'Gestión de EPP y entregas diarias',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q3_prioridad_automatizacion!: string;

  @ApiProperty({
    description: 'Velocidad actual de respuesta operativa',
    example: 'Nos enteramos al rato, a veces al día siguiente',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q4_velocidad_respuesta!: string;

  @ApiProperty({
    description: 'Stack actual de registros operativos',
    example: 'Excel + WhatsApp + papel',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q5_stack_registros!: string;

  @ApiProperty({
    description: 'Mayor dolor administrativo actual',
    example: 'Juntar la evidencia para auditorías',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q6_dolor_administrativo!: string;

  @ApiProperty({
    description: 'Temperatura / disposición a adoptar tecnología nueva',
    example: 'Interesado, dependiendo del equipo',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q7_temperatura_adopcion!: string;
}
