import type { PrioridadOportunidad } from '../dto/reporte-generado.dto';

export interface PerfilOperativoDeepSeek {
  resumen: string;
  lecturaClave: string;
}

export interface OportunidadDeepSeek {
  titulo: string;
  descripcion: string;
  comoLoResolveriamos: string;
  ahorroEstimadoHorasSemana: string;
  prioridad: PrioridadOportunidad;
  impactoEsperado: string;
}

export interface ProximoPasoDeepSeek {
  titulo: string;
  descripcion: string;
}

export interface ProximosPasosDeepSeek {
  parrafoIntro: string;
  opciones: ProximoPasoDeepSeek[];
}

export interface ReporteDeepSeekOutput {
  saludo: string;
  perfilOperativo: PerfilOperativoDeepSeek;
  oportunidades: OportunidadDeepSeek[];
  proximosPasos: ProximosPasosDeepSeek;
  cierre: string;
}
