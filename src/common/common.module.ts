import { Module } from '@nestjs/common';
import { SecretKeyGuard } from './guards/secret-key.guard';

@Module({
  providers: [SecretKeyGuard],
  exports: [SecretKeyGuard],
})
export class CommonModule {}
