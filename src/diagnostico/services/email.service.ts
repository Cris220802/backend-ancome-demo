import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Resend } from 'resend';
import type { DatosContactoDto } from '../dto/datos-contacto.dto';
import type { RespuestasDto } from '../dto/respuestas.dto';
import type { ReporteDeepSeekOutput } from '../types/reporte.types';

interface CorreoContext extends ReporteDeepSeekOutput {
  nombreVisitante: string;
  fechaGeneracion: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly subject: string;
  private readonly internalNotificationEmail: string | null;
  private template: HandlebarsTemplateDelegate<CorreoContext> | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY no configurada');
    }
    this.resend = new Resend(apiKey);
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') ?? '';
    this.fromName = this.configService.get<string>('RESEND_FROM_NAME') ?? '';
    this.subject = this.configService.get<string>('REPORT_SUBJECT') ?? '';
    const internal =
      this.configService.get<string>('INTERNAL_NOTIFICATION_EMAIL')?.trim() ??
      '';
    this.internalNotificationEmail = internal.length > 0 ? internal : null;
  }

  onModuleInit(): void {
    Handlebars.registerHelper('inc', (value: number) => value + 1);
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'correo.template.hbs',
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Plantilla del correo no encontrada en: ${templatePath}. ` +
          'Verifica que nest-cli.json copie src/diagnostico/templates/**/*.hbs a dist/.',
      );
    }
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    this.template = Handlebars.compile<CorreoContext>(templateSource);
    this.logger.log(
      `EmailService inicializado — from="${this.fromName} <${this.fromEmail}>"`,
    );
  }

  async enviarReporte(
    datosContacto: DatosContactoDto,
    reporte: ReporteDeepSeekOutput,
    pdfBuffer: Buffer,
  ): Promise<{ idEnvio: string }> {
    if (!this.template) {
      throw new ServiceUnavailableException(
        'EmailService no inicializado correctamente',
      );
    }

    const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.template({
      ...reporte,
      nombreVisitante: datosContacto.nombre,
      fechaGeneracion,
    });

    const filename = this.nombreArchivoPdf(datosContacto.nombre);

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [datosContacto.correo],
        subject: this.subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
          },
        ],
      });

      if (error) {
        this.logger.error(
          `Resend rechazó el envío: ${error.name ?? 'unknown'} — ${error.message ?? JSON.stringify(error)}`,
        );
        throw new ServiceUnavailableException(
          'No fue posible enviar el correo en este momento.',
        );
      }

      const idEnvio = data?.id ?? 'unknown';
      this.logger.log(
        `Correo enviado — id=${idEnvio} a=${this.enmascararCorreo(datosContacto.correo)}`,
      );
      return { idEnvio };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error al enviar correo via Resend: ${message}`, stack);
      throw new ServiceUnavailableException(
        'No fue posible enviar el correo en este momento.',
      );
    }
  }

  async enviarNotificacionInterna(
    datosContacto: DatosContactoDto,
    respuestas: RespuestasDto,
    reporte: ReporteDeepSeekOutput,
    pdfBuffer: Buffer,
  ): Promise<void> {
    if (!this.internalNotificationEmail) {
      return;
    }

    const fechaCompleta = new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `Nuevo lead Ancome — ${datosContacto.nombre} (${datosContacto.empresa})`;
    const html = this.buildNotificacionInternaHtml(
      datosContacto,
      respuestas,
      reporte,
      fechaCompleta,
    );
    const filename = this.nombreArchivoPdf(datosContacto.nombre);

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [this.internalNotificationEmail],
        subject,
        html,
        attachments: [{ filename, content: pdfBuffer }],
      });

      if (error) {
        this.logger.warn(
          `Notificación interna falló (no afecta al cliente): ${error.name ?? 'unknown'} — ${error.message ?? JSON.stringify(error)}`,
        );
        return;
      }

      this.logger.log(
        `Notificación interna enviada — id=${data?.id ?? 'unknown'} a=${this.enmascararCorreo(this.internalNotificationEmail)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Notificación interna lanzó excepción (no afecta al cliente): ${message}`,
      );
    }
  }

  private buildNotificacionInternaHtml(
    datosContacto: DatosContactoDto,
    respuestas: RespuestasDto,
    reporte: ReporteDeepSeekOutput,
    fechaCompleta: string,
  ): string {
    const escape = (v: string | undefined): string =>
      (v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const filaContacto = (etiqueta: string, valor: string): string => `
      <tr>
        <td style="padding:6px 12px 6px 0; color:#737373; font-size:13px; vertical-align:top; white-space:nowrap;">${etiqueta}</td>
        <td style="padding:6px 0; color:#1a1a1a; font-size:13px;">${escape(valor)}</td>
      </tr>`;

    const filaRespuesta = (etiqueta: string, valor: string): string => `
      <tr>
        <td style="padding:8px 0; vertical-align:top;">
          <div style="font-size:11px; font-weight:bold; color:#d10000; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:3px;">${etiqueta}</div>
          <div style="font-size:13px; color:#1a1a1a; line-height:1.5;">${escape(valor)}</div>
        </td>
      </tr>`;

    const oportunidades = reporte.oportunidades
      .map(
        (o, idx) => `
        <div style="margin-bottom:12px; padding:12px; border:1px solid #e8e8e8; border-radius:6px; background:#fafafa;">
          <div style="font-size:11px; color:#d10000; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">Oportunidad ${idx + 1} · ${escape(o.prioridad)}</div>
          <div style="font-size:14px; font-weight:bold; color:#1a1a1a; margin-top:4px;">${escape(o.titulo)}</div>
          <div style="font-size:12px; color:#434343; margin-top:6px; line-height:1.5;">${escape(o.descripcion)}</div>
          <div style="font-size:11px; color:#737373; margin-top:6px;"><strong>Ahorro:</strong> ${escape(o.ahorroEstimadoHorasSemana)}</div>
        </div>`,
      )
      .join('');

    return `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8" /></head>
<body style="margin:0; padding:24px; font-family:Arial,Helvetica,sans-serif; background:#f5f5f5;">
  <div style="max-width:680px; margin:0 auto; background:#ffffff; padding:28px; border-radius:8px;">
    <div style="font-size:11px; color:#d10000; font-weight:bold; letter-spacing:2px; text-transform:uppercase;">Nuevo lead — Ancome stand</div>
    <h1 style="margin:6px 0 2px 0; font-size:20px; color:#1a1a1a;">${escape(datosContacto.nombre)}</h1>
    <div style="font-size:13px; color:#737373; margin-bottom:18px;">${escape(datosContacto.empresa)} · ${fechaCompleta}</div>

    <div style="font-size:11px; font-weight:bold; color:#d10000; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">Datos de contacto</div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      ${filaContacto('Nombre', datosContacto.nombre)}
      ${filaContacto('Correo', datosContacto.correo)}
      ${filaContacto('Empresa', datosContacto.empresa)}
      ${filaContacto('Puesto', datosContacto.puesto)}
      ${filaContacto('Teléfono', datosContacto.telefono ?? '(no proporcionado)')}
      ${filaContacto('Autoriza contacto', datosContacto.autorizaContacto ? 'Sí' : 'No')}
    </table>

    <div style="font-size:11px; font-weight:bold; color:#d10000; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">Respuestas del cuestionario</div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
      ${filaRespuesta('Q1 — Rol de la empresa', respuestas.q1_rol_empresa)}
      ${filaRespuesta('Q2 — Tamaño de operación', respuestas.q2_tamano_operacion)}
      ${filaRespuesta('Q3 — Día típico / procesos manuales', respuestas.q3_dia_tipico_operacion)}
      ${filaRespuesta('Q4 — Velocidad de respuesta', respuestas.q4_velocidad_respuesta)}
      ${filaRespuesta('Q5 — Stack de registros', respuestas.q5_stack_registros)}
      ${filaRespuesta('Q6 — Dolor administrativo', respuestas.q6_dolor_administrativo)}
      ${filaRespuesta('Q7 — Apertura a digitalizar', respuestas.q7_temperatura_adopcion)}
    </table>

    <div style="font-size:11px; font-weight:bold; color:#d10000; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">Oportunidades generadas</div>
    ${oportunidades}

    <div style="margin-top:20px; padding-top:14px; border-top:1px solid #e8e8e8; font-size:11px; color:#a0a0a0;">
      Reporte completo adjunto en PDF. Esta es una notificación interna de persistencia — el visitante recibió su propio correo con el reporte.
    </div>
  </div>
</body></html>`;
  }

  private nombreArchivoPdf(nombre: string): string {
    const sinDiacriticos = nombre
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const slug = sinDiacriticos
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `Diagnostico-Ancome-${slug || 'visitante'}.pdf`;
  }

  private enmascararCorreo(correo: string): string {
    const [user, domain] = correo.split('@');
    if (!user || !domain) return '***';
    const visible = user.slice(0, 2);
    return `${visible}***@${domain}`;
  }
}
