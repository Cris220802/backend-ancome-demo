import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import puppeteer, { Browser } from 'puppeteer';
import type { ReporteDeepSeekOutput } from '../types/reporte.types';

interface ReporteContext extends ReporteDeepSeekOutput {
  nombreVisitante: string;
  fechaGeneracion: string;
}

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private template: HandlebarsTemplateDelegate<ReporteContext> | null = null;

  async onModuleInit(): Promise<void> {
    Handlebars.registerHelper('inc', (value: number) => value + 1);

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'reporte.template.hbs',
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Plantilla del reporte no encontrada en: ${templatePath}. ` +
          'Verifica que nest-cli.json copie src/diagnostico/templates/**/*.hbs a dist/.',
      );
    }
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    this.template = Handlebars.compile<ReporteContext>(templateSource);
    this.logger.log(`Plantilla compilada desde: ${templatePath}`);

    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const version = await this.browser.version();
    this.logger.log(`PdfService inicializado — browser: ${version}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Browser de Puppeteer cerrado');
    }
  }

  async generarPdf(
    datosReporte: ReporteDeepSeekOutput,
    nombreVisitante: string,
  ): Promise<Buffer> {
    if (!this.browser || !this.template) {
      throw new InternalServerErrorException(
        'PdfService no inicializado correctamente',
      );
    }

    const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.template({
      ...datosReporte,
      nombreVisitante,
      fechaGeneracion,
    });

    const page = await this.browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfData = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });

      const buffer = Buffer.from(pdfData);
      this.logger.log(
        `PDF generado — tamaño: ${(buffer.length / 1024).toFixed(1)} KB`,
      );
      return buffer;
    } finally {
      await page.close();
    }
  }
}
