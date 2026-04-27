import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OportunidadDto } from './reporte-generado.dto';

export type ModoEntrada = 'opciones' | 'texto' | 'mixto' | 'multiseleccion';

export class TurnoChatDto {
  @ApiProperty({
    enum: ['turno'],
    description: 'Discriminador de la respuesta. "turno" = sigue conversación.',
  })
  tipo!: 'turno';

  @ApiProperty({
    description: 'Mensaje del bot dirigido al visitante.',
    example: '¿Cuál es el rol principal de su empresa en minería?',
  })
  mensaje!: string;

  @ApiProperty({
    enum: ['opciones', 'texto', 'mixto', 'multiseleccion'],
    description:
      'Cómo debe renderizar el front la entrada del usuario para este turno. "opciones" = chips que auto-envían (selección única); "texto" = textbox libre; "mixto" = textbox + chips que prellenan el textbox sin enviar; "multiseleccion" = chips toggleables, el usuario marca varios y confirma con un botón.',
  })
  modoEntrada!: ModoEntrada;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Sugerencias rápidas. Requeridas si modoEntrada es "opciones", "mixto" o "multiseleccion". Entre 3 y 5 elementos. Omitir para "texto".',
    example: [
      'Contratista minero',
      'Operadora minera',
      'Proveedor de servicios',
      'Consultoría / ingeniería',
    ],
  })
  opcionesRapidas?: string[];

  @ApiPropertyOptional({
    description:
      'Texto sugerido como placeholder del textbox cuando modoEntrada es "texto" o "mixto". Ayuda al usuario a entender qué tipo de respuesta se espera. Máximo 200 caracteres. Ignorar para modos "opciones" y "multiseleccion".',
    example: 'Ej: Nos enteramos al rato, a veces al día siguiente.',
  })
  placeholderHint?: string;
}

export class TurnoFinalizadoDto {
  @ApiProperty({
    enum: ['finalizado'],
    description:
      'Discriminador de la respuesta. "finalizado" = diagnóstico completo, reporte generado y correo enviado.',
  })
  tipo!: 'finalizado';

  @ApiProperty({
    description: 'Mensaje de cierre del bot para mostrar en la tablet.',
    example:
      'Listo. Ya le envié su reporte personalizado al correo registrado.',
  })
  mensaje!: string;

  @ApiProperty({
    type: [OportunidadDto],
    description: 'Las 3 oportunidades principales para mostrar en la tablet.',
  })
  oportunidades!: OportunidadDto[];

  @ApiProperty({
    description: 'Si el correo con el PDF se envió correctamente.',
    example: true,
  })
  correoEnviado!: boolean;
}

export type ChatTurnoResponseDto = TurnoChatDto | TurnoFinalizadoDto;
