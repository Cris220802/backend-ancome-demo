import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  const allowedOriginsRaw = config.get<string>('ALLOWED_ORIGINS') ?? '';
  const allowedOrigins = allowedOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-ancome-secret-key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ancome Backend API')
    .setDescription(
      'Backend de la demo de Ancome Soluciones. Recibe las respuestas del cuestionario del stand, genera un reporte personalizado con DeepSeek y lo envía por correo en PDF.',
    )
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-ancome-secret-key', in: 'header' },
      'ancome-secret-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(config.get<number>('PORT') ?? 3000);
  await app.listen(port);

  logger.log('Ancome Backend iniciado');
  logger.log(`  Entorno:       ${nodeEnv}`);
  logger.log(`  Puerto:        ${port}`);
  logger.log(`  CORS origins:  ${allowedOrigins.join(', ') || '(ninguno)'}`);
  logger.log(`  Swagger UI:    http://localhost:${port}/api/docs`);
  logger.log('  Variables de entorno validadas correctamente');
}

void bootstrap();
