import { Injectable, Logger } from '@nestjs/common';
import { GenerarReporteDto } from './dto/generar-reporte.dto';
import { ReporteGeneradoDto } from './dto/reporte-generado.dto';

@Injectable()
export class DiagnosticoService {
  private readonly logger = new Logger(DiagnosticoService.name);

  async procesarDiagnostico(dto: GenerarReporteDto): Promise<ReporteGeneradoDto> {
    const iniciales = dto.datosContacto.nombre
      .split(/\s+/)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join('');

    this.logger.log(`Procesando diagnóstico para visitante: ${iniciales}`);

    return Promise.resolve({
      exito: true,
      mensaje: 'Reporte generado correctamente (mock — Fase 5)',
      oportunidades: [
        {
          titulo: 'Digitalizar registros de EPP',
          descripcion:
            'Reemplazar papel por captura en tableta con firma biométrica y sincronización a la nube.',
          ahorroEstimadoHorasSemana: '6-9 horas/semana',
          prioridad: 'alta',
        },
        {
          titulo: 'Dashboard de indicadores operativos',
          descripcion:
            'Visibilidad en tiempo real de entregas, incidentes y asistencia desde un panel único.',
          ahorroEstimadoHorasSemana: '3-5 horas/semana',
          prioridad: 'media',
        },
        {
          titulo: 'Automatizar reportes de evidencia',
          descripcion:
            'Generación automática de los PDFs de evidencia que hoy se arman a mano para auditorías.',
          ahorroEstimadoHorasSemana: '2-4 horas/semana',
          prioridad: 'media',
        },
      ],
      correoEnviado: false,
    });
  }
}
