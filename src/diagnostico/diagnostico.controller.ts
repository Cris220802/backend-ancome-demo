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
@UseGuards(SecretKeyGuard)
@Controller('api/diagnostico')
export class DiagnosticoController {
  constructor(private readonly diagnosticoService: DiagnosticoService) {}

  @Post('generar-reporte')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar y enviar reporte personalizado',
    description:
      'Recibe las respuestas del cuestionario y los datos de contacto del visitante. Genera un reporte con Claude, lo convierte en PDF, lo envía por correo con Resend y devuelve las 3 oportunidades principales para mostrar en la tablet.',
  })
  @ApiBody({ type: GenerarReporteDto })
  @ApiOkResponse({ type: ReporteGeneradoDto, description: 'Reporte generado y correo enviado' })
  @ApiUnauthorizedResponse({ description: 'Secret key ausente o inválido' })
  @ApiBadRequestResponse({ description: 'Body inválido o incompleto' })
  @ApiServiceUnavailableResponse({
    description: 'Fallo en generación de reporte o envío de correo',
  })
  async generarReporte(
    @Body() dto: GenerarReporteDto,
  ): Promise<ReporteGeneradoDto> {
    return this.diagnosticoService.procesarDiagnostico(dto);
  }
}
