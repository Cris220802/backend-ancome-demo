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
  ApiHeader,
  ApiOperation,
  ApiOkResponse,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SecretKeyGuard } from '../common/guards/secret-key.guard';
import { DiagnosticoService } from './diagnostico.service';
import { GenerarReporteDto } from './dto/generar-reporte.dto';
import { ReporteGeneradoDto } from './dto/reporte-generado.dto';

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
@UseGuards(SecretKeyGuard)
@Controller('api/diagnostico')
export class DiagnosticoController {
  constructor(private readonly diagnosticoService: DiagnosticoService) {}

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
}
