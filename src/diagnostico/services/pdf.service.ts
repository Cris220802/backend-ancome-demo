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
  logoDataUrl: string | null;
}

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private template: HandlebarsTemplateDelegate<ReporteContext> | null = null;
  private logoDataUrl: string | null = null;

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

    this.logoDataUrl = this.cargarLogo();

    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const version = await this.browser.version();
    this.logger.log(`PdfService inicializado — browser: ${version}`);
  }

  private cargarLogo(): string | null {
    const candidatos = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg'];
    const assetsDir = path.join(__dirname, '..', 'templates', 'assets');

    for (const archivo of candidatos) {
      const rutaCompleta = path.join(assetsDir, archivo);
      if (!fs.existsSync(rutaCompleta)) continue;

      const buffer = fs.readFileSync(rutaCompleta);
      const mime = this.mimeFromExtension(archivo);
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      this.logger.log(
        `Logo cargado desde ${archivo} — ${(buffer.length / 1024).toFixed(1)} KB`,
      );
      return dataUrl;
    }

    this.logger.warn(
      `Logo no encontrado en ${assetsDir}. El reporte usará el header de texto como fallback. ` +
        'Para incluir logo, agrega src/diagnostico/templates/assets/logo.png',
    );
    return null;
  }

  private mimeFromExtension(archivo: string): string {
    const ext = path.extname(archivo).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.svg') return 'image/svg+xml';
    return 'application/octet-stream';
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
      logoDataUrl: this.logoDataUrl,
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
