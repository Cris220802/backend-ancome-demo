# Ancome Backend — Demo de feria

Backend NestJS minimalista que recibe las respuestas del cuestionario del stand de Ancome Soluciones, genera un reporte personalizado con DeepSeek, lo renderiza en PDF con Puppeteer y lo envía al visitante por correo con Resend (HTML + PDF adjunto). Pensado para una feria minera de 1 día: **un solo endpoint productivo**, sin base de datos, sin autenticación de usuarios — un *shared secret* en header valida que la petición venga de la app móvil.

## Stack

- **NestJS 11** + TypeScript estricto + Node.js 22.x
- **DeepSeek V4 Pro** vía SDK `openai@6` (DeepSeek expone `chat.completions` compatible OpenAI)
- **Puppeteer 24** (Chromium headless) + **Handlebars 4** para PDF
- **Resend 6** para correo transaccional con adjunto
- `@nestjs/config` + **Joi** para validar variables de entorno al arrancar
- `@nestjs/throttler` (10 req/min/IP), `helmet`, `class-validator`, **Swagger** (UI en `/api/docs`)

## Instalación local

### Requisitos
- Node.js **20.x o 22.x**
- npm 10+
- Acceso a internet en el primer `npm install` para que Puppeteer descargue Chromium (~300 MB, una sola vez)
- Credenciales: API key de DeepSeek y de Resend, dominio verificado en Resend

### Pasos

```bash
git clone <repo>
cd ancome-backend
npm install
cp .env.example .env
# editar .env y completar las API keys
npm run start:dev
```

Al arrancar verás en consola el puerto, las rutas mapeadas y la URL de Swagger.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Modo watch para desarrollo |
| `npm run start` | Arranca con `nest start` (sin watch) |
| `npm run start:prod` | Ejecuta `node dist/main` (requiere build previo) |
| `npm run build` | Compila TS + copia plantillas `.hbs` a `dist/` |
| `npm run lint` | Lint con ESLint + autofix |
| `npm run format` | Formatea con Prettier |

## Endpoints

### `GET /health`
Healthcheck público (sin guard, sin throttler). Devuelve `{ status, timestamp, uptime }`.

### `POST /api/diagnostico/generar-reporte`
Endpoint principal. Protegido por `SecretKeyGuard`.

**Headers:**
- `Content-Type: application/json`
- `x-ancome-secret-key: <ANCOME_SECRET_KEY del .env>`

**Body** (todos los campos requeridos excepto `telefono`):

```json
{
  "respuestas": {
    "q1_rol_empresa": "Contratista de operación",
    "q2_tamano_operacion": "Entre 30 y 80 personas",
    "q3_prioridad_automatizacion": "Control de EPP",
    "q4_velocidad_respuesta": "Nos toma un rato",
    "q5_stack_registros": "Excel y WhatsApp",
    "q6_dolor_administrativo": "Armar evidencia",
    "q7_temperatura_adopcion": "Queremos modernizarnos"
  },
  "datosContacto": {
    "nombre": "Juan Ramírez",
    "correo": "juan@ejemplo.com",
    "empresa": "Contratista Demo SA",
    "puesto": "Gerente de operaciones",
    "telefono": "+52 555 555 0000",
    "autorizaContacto": true
  }
}
```

**Response 200:**

```json
{
  "exito": true,
  "mensaje": "Reporte generado y enviado exitosamente a su correo.",
  "oportunidades": [
    { "titulo": "...", "descripcion": "...", "ahorroEstimadoHorasSemana": "8-12 horas/semana", "prioridad": "alta" },
    { "titulo": "...", "descripcion": "...", "ahorroEstimadoHorasSemana": "4-6 horas/semana", "prioridad": "media" },
    { "titulo": "...", "descripcion": "...", "ahorroEstimadoHorasSemana": "5-8 horas/semana", "prioridad": "alta" }
  ],
  "correoEnviado": true
}
```

**Códigos de error:**
- `400` — body inválido o incompleto
- `401` — secret key ausente o no coincide
- `429` — rate limit (10 req/min/IP)
- `503` — DeepSeek caído / timeout / JSON inválido, o Resend rechazó el envío

Latencia esperada: **~80 segundos** (DeepSeek es el cuello de botella). La app móvil debe mostrar un spinner con copia que prepare al visitante.

### `GET /api/docs`
Swagger UI. Permite probar el endpoint con el header de auth precargado vía botón **Authorize**.

## Variables de entorno

Ver [`.env.example`](./.env.example) para los valores plantilla. Todas se validan con Joi al arrancar; si falta alguna, el servidor no inicia.

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP. Default `3000`. |
| `NODE_ENV` | `development` o `production`. |
| `ANCOME_SECRET_KEY` | Shared secret entre app móvil y backend (mín. 32 chars). |
| `ALLOWED_ORIGINS` | Lista separada por comas de orígenes CORS. |
| `DEEPSEEK_API_KEY` | API key de DeepSeek. |
| `DEEPSEEK_MODEL` | Modelo. Default `deepseek-v4-pro`. |
| `DEEPSEEK_BASE_URL` | URL del endpoint DeepSeek. Default `https://api.deepseek.com`. |
| `RESEND_API_KEY` | API key de Resend. |
| `RESEND_FROM_EMAIL` | Dirección de envío (debe estar en un dominio verificado en Resend). |
| `RESEND_FROM_NAME` | Nombre que aparece como remitente. |
| `REPORT_SUBJECT` | Asunto del correo enviado al visitante. |

## Deployment

Ver [`SETUP_NOTES.md`](./SETUP_NOTES.md) para checklist de producción y notas operativas.

### Con Docker (recomendado)

```bash
docker build -t ancome-backend .
docker run --rm -p 3000:3000 --env-file .env ancome-backend
```

El [`Dockerfile`](./Dockerfile) es multi-stage: compila en una imagen con todas las deps y produce una runtime slim con Chromium del sistema (`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`) — evita descargar Chromium en cada build y mantiene la imagen final liviana.

### Sin Docker

`npm run build && PORT=3000 NODE_ENV=production node dist/main`

En producción Puppeteer necesita Chromium disponible. La opción más simple es dejar que Puppeteer lo descargue durante `npm install` (ya pasa por defecto). En hosts con sistema de archivos efímero, prefiere instalar Chromium del sistema y setear `PUPPETEER_EXECUTABLE_PATH`.
