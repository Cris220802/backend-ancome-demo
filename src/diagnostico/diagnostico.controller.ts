import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiOkResponse,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { SecretKeyGuard } from '../common/guards/secret-key.guard';
import { DiagnosticoService } from './diagnostico.service';
import { ChatTurnoRequestDto } from './dto/chat-turno-request.dto';
import {
  ChatTurnoResponseDto,
  TurnoChatDto,
  TurnoFinalizadoDto,
} from './dto/chat-turno-response.dto';
import { GenerarReporteDto } from './dto/generar-reporte.dto';
import { ReporteGeneradoDto } from './dto/reporte-generado.dto';
import { ChatService } from './services/chat.service';

@ApiTags('diagnostico')
@ApiSecurity('ancome-secret-key')
@ApiHeader({
  name: 'x-ancome-secret-key',
  description:
    'Shared secret entre la app móvil y el backend. Debe coincidir exactamente con ANCOME_SECRET_KEY configurado en el .env del servidor.',
  required: true,
  schema: { type: 'string', minLength: 32 },
})
@ApiUnauthorizedResponse({
  description:
    'Header x-ancome-secret-key ausente o inválido. Verifica que esté presente y coincida con el configurado en el backend.',
})
@ApiExtraModels(TurnoChatDto, TurnoFinalizadoDto)
@UseGuards(SecretKeyGuard)
@Controller('api/diagnostico')
export class DiagnosticoController {
  constructor(
    private readonly diagnosticoService: DiagnosticoService,
    private readonly chatService: ChatService,
  ) {}

  @Post('generar-reporte')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar y enviar reporte personalizado',
    description:
      'Recibe las respuestas del cuestionario (8 preguntas) y los datos de contacto del visitante. Genera un reporte personalizado con DeepSeek (vía SDK compatible OpenAI), lo convierte en PDF con Puppeteer y lo envía por correo con Resend (HTML + PDF adjunto). Devuelve las 3 oportunidades principales para mostrar en la tablet del stand.',
  })
  @ApiBody({
    type: GenerarReporteDto,
    description:
      'Respuestas del cuestionario + datos de contacto. Todos los campos son requeridos excepto telefono.',
  })
  @ApiOkResponse({
    type: ReporteGeneradoDto,
    description:
      'Reporte generado, PDF renderizado y correo enviado correctamente. Incluye las 3 oportunidades para la tablet y un flag indicando que el correo fue enviado.',
  })
  @ApiBadRequestResponse({
    description:
      'Body inválido: campos faltantes, tipos incorrectos, longitud excedida, correo malformado, o propiedades adicionales no permitidas.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Fallo en la generación del reporte (DeepSeek caído, rate limit, timeout, o respuesta con estructura inválida) o en el envío del correo (Resend caído o rechazó). Reintentar más tarde.',
  })
  async generarReporte(
    @Body() dto: GenerarReporteDto,
  ): Promise<ReporteGeneradoDto> {
    return this.diagnosticoService.procesarDiagnostico(dto);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesar un turno conversacional con AncomeBot',
    description:
      'Recibe el historial conversacional + datos de contacto. Devuelve uno de dos tipos de turno: (a) tipo="turno" con el siguiente mensaje del bot, modoEntrada y opcionesRapidas para que el front renderice la UI; o (b) tipo="finalizado" cuando el bot decide cerrar el diagnóstico — en ese caso ya se generó el PDF y se envió el correo, y se devuelven las 3 oportunidades para mostrar en la tablet. En el primer turno, enviar mensajes=[] para que el bot abra la conversación.',
  })
  @ApiBody({
    type: ChatTurnoRequestDto,
    description:
      'Historial conversacional acumulado en el cliente + datos de contacto del visitante.',
  })
  @ApiOkResponse({
    description:
      'Turno conversacional o cierre del diagnóstico. La forma del payload depende del campo discriminador "tipo".',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(TurnoChatDto) },
        { $ref: getSchemaPath(TurnoFinalizadoDto) },
      ],
      discriminator: {
        propertyName: 'tipo',
        mapping: {
          turno: getSchemaPath(TurnoChatDto),
          finalizado: getSchemaPath(TurnoFinalizadoDto),
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Body inválido: historial mal formado, mensajes con rol distinto a user/assistant, longitud excedida, o más de 30 mensajes.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Fallo con DeepSeek (timeout, rate limit, tool-call malformado), o fallo en la generación del reporte / envío del correo al finalizar el diagnóstico.',
  })
  async chat(@Body() dto: ChatTurnoRequestDto): Promise<ChatTurnoResponseDto> {
    return this.chatService.procesarTurno(dto);
  }
}
