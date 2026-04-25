import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GenerarReporteDto } from './dto/generar-reporte.dto';
import { ReporteGeneradoDto } from './dto/reporte-generado.dto';
import { DeepseekService } from './services/deepseek.service';
import { PdfService } from './services/pdf.service';
import type { ReporteDeepSeekOutput } from './types/reporte.types';

@Injectable()
export class DiagnosticoService {
  private readonly logger = new Logger(DiagnosticoService.name);

  constructor(
    private readonly deepseekService: DeepseekService,
    private readonly pdfService: PdfService,
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
      this.logger.log(
        `PDF listo para envío — ${pdfBuffer.length} bytes (correo se envía en Fase 8)`,
      );

      // Fase 8: enviar correo con Resend usando pdfBuffer + reporte.

      return {
        exito: true,
        mensaje:
          'Reporte y PDF generados correctamente. Envío por correo pendiente de implementar.',
        oportunidades: reporte.oportunidades.map((o) => ({
          titulo: o.titulo,
          descripcion: o.descripcion,
          ahorroEstimadoHorasSemana: o.ahorroEstimadoHorasSemana,
          prioridad: o.prioridad,
        })),
        correoEnviado: false,
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

  async generarPdfDePrueba(
    dto: GenerarReporteDto,
  ): Promise<{ pdf: Buffer; nombreArchivo: string; reporte: ReporteDeepSeekOutput }> {
    const reporte = await this.deepseekService.generarReporte(
      dto.respuestas,
      dto.datosContacto,
    );
    const pdf = await this.pdfService.generarPdf(
      reporte,
      dto.datosContacto.nombre,
    );
    const nombreArchivo = `Diagnostico-Ancome-${dto.datosContacto.nombre.replace(/\s+/g, '-')}.pdf`;
    return { pdf, nombreArchivo, reporte };
  }

  private calcularIniciales(nombreCompleto: string): string {
    return nombreCompleto
      .trim()
      .split(/\s+/)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join('');
  }
}
