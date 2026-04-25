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
  }

  onModuleInit(): void {
    Handlebars.registerHelper('inc', (value: number) => value + 1);
    Handlebars.registerHelper(
      'eq',
      (a: unknown, b: unknown) => a === b,
    );

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
      this.logger.log(`Correo enviado — id=${idEnvio} a=${this.enmascararCorreo(datosContacto.correo)}`);
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
