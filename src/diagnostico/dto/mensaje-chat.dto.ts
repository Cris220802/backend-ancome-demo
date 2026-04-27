import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export type RolMensajeChat = 'user' | 'assistant';

export class MensajeChatDto {
  @ApiProperty({
    enum: ['user', 'assistant'],
    description:
      'Quién emitió el mensaje. "user" = visitante; "assistant" = AncomeBot.',
    example: 'user',
  })
  @IsString()
  @IsIn(['user', 'assistant'])
  rol!: RolMensajeChat;

  @ApiProperty({
    description: 'Texto del mensaje. Máximo 2000 caracteres.',
    example: 'Soy contratista minero, llevo unas 60 personas en cuadrilla.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  contenido!: string;
}
