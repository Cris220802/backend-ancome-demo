import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GenerarReporteDto } from './dto/generar-reporte.dto';
import { ReporteGeneradoDto } from './dto/reporte-generado.dto';
import { DeepseekService } from './services/deepseek.service';
import { EmailService } from './services/email.service';
import { PdfService } from './services/pdf.service';

@Injectable()
export class DiagnosticoService {
  private readonly logger = new Logger(DiagnosticoService.name);

  constructor(
    private readonly deepseekService: DeepseekService,
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
  ) {}

  async procesarDiagnostico(
    dto: GenerarReporteDto,
  ): Promise<ReporteGeneradoDto> {
    const iniciales = this.calcularIniciales(dto.datosContacto.nombre);
    this.logger.log(`Procesando diagnóstico para visitante: ${iniciales}`);

    try {
      const reporte = await this.deepseekService.generarReporte(
        dto.respuestas,
        dto.datosContacto,
      );

      const pdfBuffer = await this.pdfService.generarPdf(
        reporte,
        dto.datosContacto.nombre,
      );

      const { idEnvio } = await this.emailService.enviarReporte(
        dto.datosContacto,
        reporte,
        pdfBuffer,
      );
      this.logger.log(
        `Diagnóstico completo — visitante=${iniciales} envio=${idEnvio}`,
      );

      return {
        exito: true,
        mensaje: 'Reporte generado y enviado exitosamente a su correo.',
        oportunidades: reporte.oportunidades.map((o) => ({
          titulo: o.titulo,
          descripcion: o.descripcion,
          ahorroEstimadoHorasSemana: o.ahorroEstimadoHorasSemana,
          prioridad: o.prioridad,
        })),
        correoEnviado: true,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando diagnóstico: ${message}`, stack);
      throw new InternalServerErrorException(
        'Error al procesar el diagnóstico',
      );
    }
  }

  private calcularIniciales(nombreCompleto: string): string {
    return nombreCompleto
      .trim()
      .split(/\s+/)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join('');
  }
}
