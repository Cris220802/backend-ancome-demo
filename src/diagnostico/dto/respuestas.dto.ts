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
    description:
      'Síntesis del día típico de la persona clave de la operación: qué hace, qué procesos siente más manuales/artesanales (papel, memoria, llamadas, WhatsApp), qué le interrumpe',
    example:
      'El supervisor llega a las 6, pasa lista en cuaderno, reparte EPP anotando en una libreta, y el resto del día atiende llamadas de la oficina pidiéndole datos que él tiene que ir a buscar al frente.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q3_dia_tipico_operacion!: string;

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
    description:
      'Apertura del visitante a iniciar un proyecto de digitalización con un partner externo (Ancome es desarrollo a medida, no SaaS con prueba gratis)',
    example: 'Interesados, queremos entender alcance y costos primero',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  q7_temperatura_adopcion!: string;
}
