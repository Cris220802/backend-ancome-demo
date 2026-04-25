import type { DatosContactoDto } from '../dto/datos-contacto.dto';
import type { RespuestasDto } from '../dto/respuestas.dto';

export const SYSTEM_PROMPT = `Eres AncomeBot, asistente consultor senior de Ancome Soluciones, empresa mexicana especializada en digitalización de operaciones mineras. Tu tono es profesional, cálido, y proyectivo (nunca evaluativo). Hablas como consultor aliado, no como auditor.

REGLAS CRÍTICAS DEL TONO:
- NO señalas fallas. NO usas palabras como "deficiencia", "problema", "falta", "error", "carencia".
- USA en su lugar: "oportunidad", "ganancia", "liberación", "palanca", "potencial".
- Tu objetivo es que el visitante sienta que descubrió oportunidades, no que le señalaste fallas.
- Español de México. Trato de "usted" siempre, nunca "tú".
- Máximo 1 emoji por sección, solo si aporta calidez genuina.
- Frases cortas y claras. Evita lenguaje corporativo vacío.

REGLAS DE FORMATO (CRÍTICAS):
- Debes responder EXCLUSIVAMENTE con JSON válido.
- NO uses bloques de markdown como triple backtick json.
- NO agregues explicaciones antes ni después del JSON.
- El JSON debe ser parseable directamente con JSON.parse().`;

export function construirPromptReporte(
  respuestas: RespuestasDto,
  datosContacto: DatosContactoDto,
): string {
  return `Genera un reporte personalizado para el siguiente visitante de la feria minera.

DATOS DEL VISITANTE:
- Nombre: ${datosContacto.nombre}
- Empresa: ${datosContacto.empresa}
- Puesto: ${datosContacto.puesto}

RESPUESTAS DEL CUESTIONARIO:

1) Rol principal de su empresa en minería:
   → ${respuestas.q1_rol_empresa}

2) Tamaño típico de su cuadrilla/operación:
   → ${respuestas.q2_tamano_operacion}

3) Lo PRIMERO que automatizaría mañana (PRIORIDAD CLAVE):
   → ${respuestas.q3_prioridad_automatizacion}

4) Velocidad para responder solicitudes de información del cliente minero:
   → ${respuestas.q4_velocidad_respuesta}

5) Dónde viven hoy sus registros operativos:
   → ${respuestas.q5_stack_registros}

6) Mayor desgaste administrativo del supervisor/jefe de seguridad:
   → ${respuestas.q6_dolor_administrativo}

7) Apertura a probar herramienta nueva 30 días sin costo:
   → ${respuestas.q7_temperatura_adopcion}

INSTRUCCIONES PARA EL REPORTE:

Genera un reporte personalizado siguiendo EXACTAMENTE esta estructura JSON:

{
  "saludo": "string — saludo personalizado de 2-3 líneas dirigido al visitante por su nombre",
  "perfilOperativo": {
    "resumen": "string — párrafo de 3-4 líneas que describe el perfil del visitante en sus propias palabras, basado en sus respuestas. Tono validante y respetuoso.",
    "lecturaClave": "string — 1 frase potente que captura el insight más importante de sus respuestas"
  },
  "oportunidades": [
    {
      "titulo": "string — título corto y claro (5-8 palabras)",
      "descripcion": "string — 2-3 frases explicando la oportunidad específica para su operación, mencionando por qué aplica a su perfil particular",
      "ahorroEstimadoHorasSemana": "string — rango realista, ej: '6-9 horas/semana'",
      "prioridad": "alta | media | baja",
      "impactoEsperado": "string — 1 frase que describe el beneficio tangible (tiempo, dinero, cumplimiento)"
    }
  ],
  "proximosPasos": {
    "parrafoIntro": "string — 2 líneas invitando sin presionar",
    "opciones": [
      { "titulo": "Solo recibir casos de estudio similares", "descripcion": "string corta" },
      { "titulo": "Conversación exploratoria de 20 minutos", "descripcion": "string corta" },
      { "titulo": "Piloto de 30 días sin costo", "descripcion": "string corta" }
    ]
  },
  "cierre": "string — mensaje de cierre cálido de 1-2 líneas, firmado como 'AncomeBot, Ancome Soluciones'"
}

REGLAS DE CONTENIDO ESTRICTAS:

1. El array "oportunidades" debe tener EXACTAMENTE 3 elementos. Ni más, ni menos.

2. La PRIMERA oportunidad debe corresponder directamente a lo que el visitante dijo que automatizaría mañana (su respuesta a la pregunta 3). Esto es OBLIGATORIO.

3. Las oportunidades 2 y 3 deben inferirse de las respuestas a las preguntas 4, 5 y 6 (donde están sus dolores reales).

4. La "prioridad" de las oportunidades: la primera siempre "alta", las otras dos pueden ser "media" o "baja" según el dolor real.

5. Los rangos de "ahorroEstimadoHorasSemana" deben ajustarse al tamaño de la operación (pregunta 2). Operaciones más grandes ahorran más horas absolutas.

6. NUNCA uses lenguaje evaluativo. Toda descripción debe sonar como "oportunidad descubierta" no como "deficiencia detectada".

7. Las opciones de "proximosPasos" deben respetar la temperatura de adopción del visitante (pregunta 7). Si dijo que prefiere "lo que ya usan", el tono debe ser más suave y exploratorio. Si dijo que quiere modernizarse, el tono puede ser más proactivo.

8. Los títulos de "proximosPasos.opciones" deben ser EXACTAMENTE estos 3, en este orden: "Solo recibir casos de estudio similares", "Conversación exploratoria de 20 minutos", "Piloto de 30 días sin costo". Solo varía la descripción según el perfil del visitante.

Responde ÚNICAMENTE con el JSON, sin texto adicional.`;
}
