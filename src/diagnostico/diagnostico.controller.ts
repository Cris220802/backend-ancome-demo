import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiOkResponse,
  ApiProduces,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
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
      'Recibe las respuestas del cuestionario (8 preguntas) y los datos de contacto del visitante. Genera un reporte personalizado con DeepSeek (vía SDK compatible OpenAI), lo convierte en PDF y lo envía por correo con Resend (Fase 8). Devuelve las 3 oportunidades principales para mostrar en la tablet del stand.',
  })
  @ApiBody({
    type: GenerarReporteDto,
    description:
      'Respuestas del cuestionario + datos de contacto. Todos los campos son requeridos excepto telefono.',
  })
  @ApiOkResponse({
    type: ReporteGeneradoDto,
    description:
      'Reporte generado correctamente. Incluye las 3 oportunidades para la tablet y un flag indicando si el correo fue enviado.',
  })
  @ApiBadRequestResponse({
    description:
      'Body inválido: campos faltantes, tipos incorrectos, longitud excedida, correo malformado, o propiedades adicionales no permitidas.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Fallo en la generación del reporte (DeepSeek caído, rate limit, timeout, o respuesta con estructura inválida) o en el envío del correo. Reintentar más tarde.',
  })
  async generarReporte(
    @Body() dto: GenerarReporteDto,
  ): Promise<ReporteGeneradoDto> {
    return this.diagnosticoService.procesarDiagnostico(dto);
  }

  @Post('test-pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[TEMPORAL — Fase 7] Generar PDF y devolverlo como descarga',
    description:
      'Endpoint de prueba para validar la generación del PDF en local. Llama a DeepSeek, renderiza la plantilla y devuelve el PDF crudo como application/pdf. Se elimina en Fase 9.',
  })
  @ApiBody({ type: GenerarReporteDto })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'PDF binario listo para descargar.',
    content: { 'application/pdf': {} },
  })
  @ApiBadRequestResponse({ description: 'Body inválido.' })
  @ApiServiceUnavailableResponse({
    description: 'Fallo en DeepSeek o en el render del PDF.',
  })
  async testPdf(
    @Body() dto: GenerarReporteDto,
    @Res() res: Response,
  ): Promise<void> {
    const { pdf, nombreArchivo } =
      await this.diagnosticoService.generarPdfDePrueba(dto);

    res
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreArchivo}"`,
      )
      .setHeader('Content-Length', pdf.length)
      .end(pdf);
  }
}
