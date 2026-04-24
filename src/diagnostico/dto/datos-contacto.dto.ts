import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class DatosContactoDto {
  @ApiProperty({ example: 'Juan Pérez', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre!: string;

  @ApiProperty({ example: 'juan.perez@contratista-minero.com' })
  @IsEmail()
  @IsNotEmpty()
  correo!: string;

  @ApiProperty({ example: 'Servicios Mineros del Norte SA de CV', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  empresa!: string;

  @ApiProperty({ example: 'Gerente de Operaciones', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  puesto!: string;

  @ApiPropertyOptional({ example: '+52 449 123 4567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiProperty({
    description: 'Consentimiento explícito del visitante para recibir el reporte y contacto posterior',
    example: true,
  })
  @IsBoolean()
  autorizaContacto!: boolean;
}
