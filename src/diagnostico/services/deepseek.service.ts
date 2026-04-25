import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { APIError } from 'openai';
import type { DatosContactoDto } from '../dto/datos-contacto.dto';
import type { RespuestasDto } from '../dto/respuestas.dto';
import {
  SYSTEM_PROMPT,
  construirPromptReporte,
} from '../prompts/reporte-diagnostico.prompt';
import type {
  OportunidadDeepSeek,
  ReporteDeepSeekOutput,
} from '../types/reporte.types';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TOKENS = 2500;
const TEMPERATURE = 0.7;
const PRIORIDADES_VALIDAS: ReadonlyArray<OportunidadDeepSeek['prioridad']> = [
  'alta',
  'media',
  'baja',
];

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.configService.get<string>('DEEPSEEK_BASE_URL');
    this.model =
      this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-v4-pro';

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY no configurada');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 1,
    });

    this.logger.log(
      `DeepseekService inicializado con modelo ${this.model} (baseURL=${baseURL})`,
    );
  }

  async generarReporte(
    respuestas: RespuestasDto,
    datosContacto: DatosContactoDto,
  ): Promise<ReporteDeepSeekOutput> {
    const userPrompt = construirPromptReporte(respuestas, datosContacto);
    const iniciales = this.iniciales(datosContacto.nombre);
    this.logger.log(`Generando reporte para visitante: ${iniciales}`);

    const rawJson = await this.llamarDeepseek(userPrompt);
    const parsed = this.parsearRespuesta(rawJson);
    this.validarEstructura(parsed);

    return parsed;
  }

  private async llamarDeepseek(userPrompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: 'json_object' },
      });

      const tokensUsados = response.usage?.total_tokens ?? 0;
      this.logger.log(
        `Reporte generado — modelo=${this.model} total_tokens=${tokensUsados}`,
      );

      const contenido = response.choices[0]?.message?.content;
      if (!contenido) {
        this.logger.error('DeepSeek devolvió respuesta sin contenido textual');
        throw new ServiceUnavailableException(
          'No fue posible generar el reporte en este momento.',
        );
      }
      return contenido;
    } catch (error) {
      this.manejarErrorDeepseek(error);
    }
  }

  private manejarErrorDeepseek(error: unknown): never {
    if (error instanceof ServiceUnavailableException) {
      throw error;
    }

    if (error instanceof APIError) {
      const status = error.status;
      if (status === 401) {
        this.logger.error('DEEPSEEK_API_KEY inválida o expirada');
        throw new ServiceUnavailableException('Servicio de IA no disponible');
      }
      if (status === 429) {
        this.logger.error('Rate limit en DeepSeek API');
        throw new ServiceUnavailableException(
          'Servicio de IA temporalmente saturado, intente de nuevo',
        );
      }
      this.logger.error(
        `DeepSeek API error status=${status ?? 'desconocido'}: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'No fue posible generar el reporte en este momento.',
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    if (
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('etimedout')
    ) {
      this.logger.error('Timeout al llamar DeepSeek API');
      throw new ServiceUnavailableException(
        'La generación del reporte tardó demasiado, intente de nuevo',
      );
    }

    this.logger.error(`Error al generar reporte: ${message}`, stack);
    throw new ServiceUnavailableException(
      'No fue posible generar el reporte en este momento.',
    );
  }

  private parsearRespuesta(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch (error) {
      const preview = raw.slice(0, 500).replace(/\s+/g, ' ');
      this.logger.error(
        `Respuesta de DeepSeek no es JSON válido. Preview: ${preview}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'No fue posible generar el reporte en este momento.',
      );
    }
  }

  private validarEstructura(
    data: unknown,
  ): asserts data is ReporteDeepSeekOutput {
    if (!data || typeof data !== 'object') {
      this.lanzarEstructuraInvalida('raíz no es un objeto');
    }
    const obj = data as Record<string, unknown>;

    if (typeof obj.saludo !== 'string' || !obj.saludo.trim()) {
      this.lanzarEstructuraInvalida('campo "saludo" ausente o vacío');
    }

    const perfil = obj.perfilOperativo as Record<string, unknown> | undefined;
    if (
      !perfil ||
      typeof perfil.resumen !== 'string' ||
      typeof perfil.lecturaClave !== 'string'
    ) {
      this.lanzarEstructuraInvalida('campo "perfilOperativo" inválido');
    }

    if (!Array.isArray(obj.oportunidades) || obj.oportunidades.length !== 3) {
      this.lanzarEstructuraInvalida(
        `"oportunidades" debe tener exactamente 3 elementos (tiene ${
          Array.isArray(obj.oportunidades)
            ? obj.oportunidades.length
            : 'no-array'
        })`,
      );
    }

    for (const [idx, op] of obj.oportunidades.entries()) {
      const o = op as Record<string, unknown>;
      if (
        typeof o.titulo !== 'string' ||
        typeof o.descripcion !== 'string' ||
        typeof o.ahorroEstimadoHorasSemana !== 'string' ||
        typeof o.impactoEsperado !== 'string' ||
        typeof o.prioridad !== 'string' ||
        !PRIORIDADES_VALIDAS.includes(
          o.prioridad as OportunidadDeepSeek['prioridad'],
        )
      ) {
        this.lanzarEstructuraInvalida(
          `"oportunidades[${idx}]" con estructura inválida`,
        );
      }
    }

    const pasos = obj.proximosPasos as Record<string, unknown> | undefined;
    if (
      !pasos ||
      typeof pasos.parrafoIntro !== 'string' ||
      !Array.isArray(pasos.opciones) ||
      pasos.opciones.length === 0
    ) {
      this.lanzarEstructuraInvalida('campo "proximosPasos" inválido');
    }

    if (typeof obj.cierre !== 'string' || !obj.cierre.trim()) {
      this.lanzarEstructuraInvalida('campo "cierre" ausente o vacío');
    }
  }

  private lanzarEstructuraInvalida(motivo: string): never {
    this.logger.error(`Estructura de reporte inválida: ${motivo}`);
    throw new ServiceUnavailableException(
      'El reporte generado no tiene la estructura esperada.',
    );
  }

  private iniciales(nombre: string): string {
    return nombre
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3);
  }
}
