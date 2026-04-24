import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmptyObject, ValidateNested } from 'class-validator';
import { DatosContactoDto } from './datos-contacto.dto';
import { RespuestasDto } from './respuestas.dto';

export class GenerarReporteDto {
  @ApiProperty({ type: RespuestasDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => RespuestasDto)
  respuestas!: RespuestasDto;

  @ApiProperty({ type: DatosContactoDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => DatosContactoDto)
  datosContacto!: DatosContactoDto;
}
