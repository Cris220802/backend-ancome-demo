import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DiagnosticoController } from './diagnostico.controller';
import { DiagnosticoService } from './diagnostico.service';

@Module({
  imports: [CommonModule],
  controllers: [DiagnosticoController],
  providers: [DiagnosticoService],
})
export class DiagnosticoModule {}
