import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DiagnosticoController } from './diagnostico.controller';
import { DiagnosticoService } from './diagnostico.service';
import { DeepseekService } from './services/deepseek.service';

@Module({
  imports: [CommonModule],
  controllers: [DiagnosticoController],
  providers: [DiagnosticoService, DeepseekService],
})
export class DiagnosticoModule {}
