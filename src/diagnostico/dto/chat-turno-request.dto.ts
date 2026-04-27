import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmptyObject,
  ValidateNested,
} from 'class-validator';
import { DatosContactoDto } from './datos-contacto.dto';
import { MensajeChatDto } from './mensaje-chat.dto';

export class ChatTurnoRequestDto {
  @ApiProperty({ type: DatosContactoDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => DatosContactoDto)
  datosContacto!: DatosContactoDto;

  @ApiProperty({
    type: [MensajeChatDto],
    description:
      'Historial conversacional. En el primer turno enviar arreglo vacío para que el bot abra la conversación. Máximo 30 mensajes.',
    maxItems: 30,
  })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MensajeChatDto)
  mensajes!: MensajeChatDto[];
}
