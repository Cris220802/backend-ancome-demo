import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const HEADER_NAME = 'x-ancome-secret-key';

@Injectable()
export class SecretKeyGuard implements CanActivate {
  private readonly logger = new Logger(SecretKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const rawHeader = request.headers[HEADER_NAME];
    const providedKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const expectedKey = this.configService.get<string>('ANCOME_SECRET_KEY');

    if (!expectedKey) {
      this.logger.error(
        'ANCOME_SECRET_KEY no está configurado en el entorno. Ninguna petición podrá autenticarse.',
      );
      throw new UnauthorizedException('Servicio no configurado');
    }

    if (!providedKey || typeof providedKey !== 'string') {
      throw new UnauthorizedException('Secret key missing');
    }

    const providedBuffer = Buffer.from(providedKey, 'utf8');
    const expectedBuffer = Buffer.from(expectedKey, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      throw new UnauthorizedException('Invalid secret key');
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid secret key');
    }

    return true;
  }
}
