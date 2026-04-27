import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({
    example: '2026-04-24T17:58:44.123Z',
    description: 'Timestamp ISO 8601 UTC',
  })
  timestamp!: string;

  @ApiProperty({
    example: 123.456,
    description: 'Segundos desde que arrancó el proceso',
  })
  uptime!: number;
}

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Estado del servicio',
    description:
      'Endpoint público (sin autenticación ni rate limit) para liveness checks del hosting y monitoreo externo.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
