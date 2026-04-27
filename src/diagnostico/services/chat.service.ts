import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { ChatTurnoRequestDto } from '../dto/chat-turno-request.dto';
import type {
  ChatTurnoResponseDto,
  TurnoChatDto,
  TurnoFinalizadoDto,
} from '../dto/chat-turno-response.dto';
import { GenerarReporteDto } from '../dto/generar-reporte.dto';
import { RespuestasDto } from '../dto/respuestas.dto';
import {
  CHAT_TOOLS,
  SYSTEM_PROMPT_CHAT,
  construirMensajeContextoVisitante,
  type FinalizarDiagnosticoArgs,
  type ResponderTurnoArgs,
} from '../prompts/chat-conversacional.prompt';
import { DiagnosticoService } from '../diagnostico.service';
import { DeepseekService } from './deepseek.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly deepseekService: DeepseekService,
    private readonly diagnosticoService: DiagnosticoService,
  ) {}

  async procesarTurno(dto: ChatTurnoRequestDto): Promise<ChatTurnoResponseDto> {
    const iniciales = this.iniciales(dto.datosContacto.nombre);
    this.logger.log(
      `Turno de chat — visitante=${iniciales} mensajesPrevios=${dto.mensajes.length}`,
    );

    const messages = this.construirMensajes(dto);
    const tools = CHAT_TOOLS as unknown as ChatCompletionTool[];

    const toolCall = await this.deepseekService.turnoChat(messages, tools);

    if (toolCall.toolName === 'responder_turno') {
      return this.parsearTurno(toolCall.argumentosRaw);
    }

    if (toolCall.toolName === 'finalizar_diagnostico') {
      return await this.finalizarDiagnostico(
        toolCall.argumentosRaw,
        dto,
        iniciales,
      );
    }

    this.logger.error(
      `Tool desconocida invocada por el modelo: ${toolCall.toolName}`,
    );
    throw new ServiceUnavailableException(
      'El asistente no pudo continuar la conversación. Intente de nuevo.',
    );
  }

  private construirMensajes(
    dto: ChatTurnoRequestDto,
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT_CHAT },
      {
        role: 'system',
        content: construirMensajeContextoVisitante(dto.datosContacto),
      },
    ];

    for (const m of dto.mensajes) {
      messages.push({
        role: m.rol,
        content: m.contenido,
      });
    }

    return messages;
  }

  private parsearTurno(argumentosRaw: string): TurnoChatDto {
    const args = this.parsearArgumentos<ResponderTurnoArgs>(
      argumentosRaw,
      'responder_turno',
    );

    if (typeof args.mensaje !== 'string' || !args.mensaje.trim()) {
      this.lanzarTurnoInvalido('campo "mensaje" ausente o vacío');
    }
    if (
      !['opciones', 'texto', 'mixto', 'multiseleccion'].includes(
        args.modoEntrada,
      )
    ) {
      this.lanzarTurnoInvalido(
        `modoEntrada inválido: ${String(args.modoEntrada)}`,
      );
    }

    const requiereOpciones =
      args.modoEntrada === 'opciones' ||
      args.modoEntrada === 'mixto' ||
      args.modoEntrada === 'multiseleccion';
    if (requiereOpciones) {
      if (
        !Array.isArray(args.opcionesRapidas) ||
        args.opcionesRapidas.length < 3 ||
        args.opcionesRapidas.length > 5 ||
        !args.opcionesRapidas.every(
          (o) => typeof o === 'string' && o.trim().length > 0,
        )
      ) {
        this.lanzarTurnoInvalido(
          `opcionesRapidas requeridas (3-5 strings) cuando modoEntrada=${args.modoEntrada}`,
        );
      }
    }

    const aceptaPlaceholder =
      args.modoEntrada === 'texto' || args.modoEntrada === 'mixto';
    let placeholderHint: string | undefined;
    if (aceptaPlaceholder && typeof args.placeholderHint === 'string') {
      const trimmed = args.placeholderHint.trim();
      if (trimmed.length > 0 && trimmed.length <= 200) {
        placeholderHint = trimmed;
      } else if (trimmed.length > 200) {
        this.logger.warn(
          `placeholderHint excede 200 chars (${trimmed.length}); se descarta.`,
        );
      }
    }

    const esUltimaPregunta = args.esUltimaPregunta === true;

    return {
      tipo: 'turno',
      mensaje: args.mensaje.trim(),
      modoEntrada: args.modoEntrada,
      opcionesRapidas: requiereOpciones ? args.opcionesRapidas : undefined,
      placeholderHint,
      esUltimaPregunta,
    };
  }

  private async finalizarDiagnostico(
    argumentosRaw: string,
    dto: ChatTurnoRequestDto,
    iniciales: string,
  ): Promise<TurnoFinalizadoDto> {
    const args = this.parsearArgumentos<FinalizarDiagnosticoArgs>(
      argumentosRaw,
      'finalizar_diagnostico',
    );

    if (typeof args.mensajeCierre !== 'string' || !args.mensajeCierre.trim()) {
      this.lanzarTurnoInvalido('campo "mensajeCierre" ausente o vacío');
    }

    const respuestas = await this.construirYValidarRespuestas(args);
    this.logger.log(
      `Finalizando diagnóstico desde chat — visitante=${iniciales}`,
    );

    const generarDto: GenerarReporteDto = {
      respuestas,
      datosContacto: dto.datosContacto,
    };

    const reporte =
      await this.diagnosticoService.procesarDiagnostico(generarDto);

    return {
      tipo: 'finalizado',
      mensaje: args.mensajeCierre.trim(),
      oportunidades: reporte.oportunidades,
      correoEnviado: reporte.correoEnviado,
    };
  }

  private async construirYValidarRespuestas(
    args: FinalizarDiagnosticoArgs,
  ): Promise<RespuestasDto> {
    const candidata = plainToInstance(RespuestasDto, {
      q1_rol_empresa: args.q1_rol_empresa,
      q2_tamano_operacion: args.q2_tamano_operacion,
      q3_dia_tipico_operacion: args.q3_dia_tipico_operacion,
      q4_velocidad_respuesta: args.q4_velocidad_respuesta,
      q5_stack_registros: args.q5_stack_registros,
      q6_dolor_administrativo: args.q6_dolor_administrativo,
      q7_temperatura_adopcion: args.q7_temperatura_adopcion,
    });

    const errores = await validate(candidata);
    if (errores.length > 0) {
      const detalle = errores
        .map(
          (e) =>
            `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
        )
        .join(' | ');
      this.logger.error(
        `Respuestas sintetizadas por el modelo no validan contra RespuestasDto: ${detalle}`,
      );
      throw new ServiceUnavailableException(
        'El asistente no pudo cerrar el diagnóstico correctamente. Intente de nuevo.',
      );
    }

    return candidata;
  }

  private parsearArgumentos<T>(raw: string, toolName: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      const preview = raw.slice(0, 300).replace(/\s+/g, ' ');
      this.logger.error(
        `Argumentos inválidos en tool ${toolName}. Preview: ${preview}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'El asistente devolvió datos malformados. Intente de nuevo.',
      );
    }
  }

  private lanzarTurnoInvalido(motivo: string): never {
    this.logger.error(`Turno inválido del modelo: ${motivo}`);
    throw new ServiceUnavailableException(
      'El asistente devolvió un turno con estructura inválida. Intente de nuevo.',
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
