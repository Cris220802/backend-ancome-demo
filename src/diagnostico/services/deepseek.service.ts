import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { APIError } from 'openai';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
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
const MAX_TOKENS = 8192;
const CHAT_MAX_TOKENS = 1024;
const TEMPERATURE = 0.7;
const CHAT_TEMPERATURE = 0.6;

export type ToolCallResultado = {
  toolName: string;
  argumentosRaw: string;
};
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

  async turnoChat(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
  ): Promise<ToolCallResultado> {
    // Campo específico de DeepSeek (no tipado por el SDK de OpenAI):
    // los modelos v4 corren en thinking mode por default, y thinking
    // mode no soporta tool_choice='required'. Se desactiva para chat.
    const params = {
      model: this.model,
      messages,
      tools,
      tool_choice: 'required',
      max_tokens: CHAT_MAX_TOKENS,
      temperature: CHAT_TEMPERATURE,
      thinking: { type: 'disabled' },
    } as unknown as ChatCompletionCreateParamsNonStreaming;

    try {
      const response = await this.client.chat.completions.create(params);

      const choice = response.choices[0];
      const finishReason = choice?.finish_reason;
      const tokensUsados = response.usage?.total_tokens ?? 0;
      this.logger.log(
        `Turno de chat — modelo=${this.model} total_tokens=${tokensUsados} finish_reason=${finishReason ?? 'desconocido'}`,
      );

      if (finishReason === 'length') {
        this.logger.error(
          `DeepSeek cortó el turno por límite de tokens (max_tokens=${CHAT_MAX_TOKENS}).`,
        );
        throw new ServiceUnavailableException(
          'La respuesta del asistente superó el límite de tokens. Intente de nuevo.',
        );
      }

      const toolCall = choice?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== 'function') {
        this.logger.error(
          `DeepSeek no invocó ninguna tool (finish_reason=${finishReason ?? 'desconocido'}).`,
        );
        throw new ServiceUnavailableException(
          'El asistente no pudo continuar la conversación. Intente de nuevo.',
        );
      }

      return {
        toolName: toolCall.function.name,
        argumentosRaw: toolCall.function.arguments,
      };
    } catch (error) {
      this.manejarErrorDeepseek(error);
    }
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
      const completionTokens = response.usage?.completion_tokens ?? 0;
      const finishReason = response.choices[0]?.finish_reason;
      this.logger.log(
        `Reporte generado — modelo=${this.model} total_tokens=${tokensUsados} completion_tokens=${completionTokens} finish_reason=${finishReason ?? 'desconocido'}`,
      );

      if (finishReason === 'length') {
        this.logger.error(
          `DeepSeek cortó la respuesta por límite de tokens (max_tokens=${MAX_TOKENS}, completion_tokens=${completionTokens}). El JSON está truncado.`,
        );
        throw new ServiceUnavailableException(
          'El reporte generado superó el límite de tokens. Intente de nuevo.',
        );
      }

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
      const status: number | undefined =
        typeof error.status === 'number' ? error.status : undefined;
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
        typeof o.comoLoResolveriamos !== 'string' ||
        !o.comoLoResolveriamos.trim() ||
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
