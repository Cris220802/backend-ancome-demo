# SETUP NOTES — Ancome Backend

Notas operativas y de despliegue. Complementa al [`README.md`](./README.md).

## Versiones instaladas (top-level)

| Paquete | Versión |
|---|---|
| `@nestjs/common` | ^11.0.1 |
| `@nestjs/config` | ^4.0.4 |
| `@nestjs/core` | ^11.0.1 |
| `@nestjs/platform-express` | ^11.0.1 |
| `@nestjs/swagger` | ^11.4.1 |
| `@nestjs/throttler` | ^6.5.0 |
| `class-transformer` | ^0.5.1 |
| `class-validator` | ^0.15.1 |
| `handlebars` | ^4.7.9 |
| `helmet` | ^8.1.0 |
| `joi` | ^18.1.2 |
| `openai` | ^6.34.0 |
| `puppeteer` | ^24.42.0 |
| `reflect-metadata` | ^0.2.2 |
| `resend` | ^6.12.2 |
| `rxjs` | ^7.8.1 |

Node.js objetivo: **22.x** (también funciona en 20.x).

## Decisiones técnicas

- **DeepSeek vía SDK de OpenAI** (no `@anthropic-ai/sdk`, no Anthropic, no SDK propio de DeepSeek). DeepSeek expone `chat.completions` compatible OpenAI; basta con apuntar `baseURL` a `https://api.deepseek.com`. Ventaja: SDK maduro y estable.
- **`response_format: { type: 'json_object' }`** + validación de estructura del JSON parseado en `DeepseekService.validarEstructura`. Si el modelo devuelve algo malformado, se loggea y se devuelve `503` claro al cliente.
- **`max_tokens: 8192`** y detección de `finish_reason === 'length'` *antes* del `JSON.parse`, para evitar el `SyntaxError: Unterminated string` cuando el modelo trunca por límite. Valor escogido para tener margen amplio sobre los ~3000 completion tokens que el reporte suele consumir.
- **PDF**: una única instancia de Chromium por proceso (`PdfService.onModuleInit`), `page.close()` por request en `finally`, `browser.close()` en `onModuleDestroy`. Plantilla compilada una sola vez al arrancar.
- **Plantilla PDF (`reporte.template.hbs`)**: A4 vertical, paleta Ancome, tipografía system-ui, `page-break-inside: avoid` en cards. Sin fuentes externas — el PDF debe ser self-contained.
- **Plantilla correo (`correo.template.hbs`)**: layout 100% basado en `<table>`, CSS inline, ancho 600px, Arial/Helvetica — para compatibilidad con Gmail/Outlook (no usar flex/grid; `<style>` puede ser stripeado).
- **Helpers Handlebars**: `inc` (numerar arrays con `@index`) y `eq` (comparar prioridad para colorear pills inline). Se registran en `onModuleInit` de `PdfService` y `EmailService` (idempotente).
- **Templates copiadas a `dist/`** vía `nest-cli.json` `assets`. Sin esto, `nest build` solo emite TypeScript y la plantilla no estaría disponible en runtime.
- **Logging**: solo iniciales del visitante, correo enmascarado (`te***@example.com`) y métricas (tokens, KB del PDF, ID de Resend). Nunca el body completo de las respuestas ni datos personales en claro.
- **Errores**: `ServiceUnavailableException (503)` para fallos externos (DeepSeek, Resend), `BadRequestException (400)` para validation, `UnauthorizedException (401)` para guard. Mensajes al cliente son genéricos; los detalles se quedan en logs.
- **Comparación de secret key timing-safe** (`crypto.timingSafeEqual`) en el `SecretKeyGuard`.

## Warnings y deuda técnica

- `resend@6.12.2` arrastra **3 advisories `moderate` por `uuid` transitivo dentro de `svix`**. `npm audit fix --force` introduce breaking changes; se queda como está hasta que Resend libere una versión que actualice `svix`.
- `@types/handlebars@4.0.40` es un **stub redirect**: handlebars trae sus propios tipos. No estorba pero podríamos quitarlo de `devDependencies` cuando hagamos limpieza.
- **Latencia E2E ~80 s** (DeepSeek 78s, PDF 1s, Resend 1s). Si para la feria es muy lento, evaluar:
  - Cambiar a `DEEPSEEK_MODEL=deepseek-v4-flash` (más rápido).
  - O mover el envío de correo a background y responder 202 inmediato a la app (sobre-ingeniería para 1 día de feria — solo si lo pide UX).
- **Throttler global a 10 req/min/IP**: el `/health` está exento con `@SkipThrottle()`. Si la tablet del stand y un device de prueba comparten IP pública (NAT), considera ampliar el límite.

## Cómo generar un nuevo `ANCOME_SECRET_KEY`

Cualquiera de estas dos formas:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# o
openssl rand -hex 32
```

Ambas producen una cadena hex de **64 caracteres** (32 bytes). El validador Joi exige mín. 32 chars; 64 da margen y es la convención del proyecto. Hay que **poner el mismo valor en la app móvil** (en su config, no en su bundle público).

## Cómo verificar el dominio en Resend

1. Resend Dashboard → **Domains** → **Add Domain** → escribir el dominio (ej. `ancome.mx` o un subdominio dedicado a notificaciones como `notificaciones.ancome.mx`).
2. Resend te muestra los registros DNS a publicar (típicamente `MX`, `TXT` con SPF, `CNAME` para DKIM, opcionalmente `TXT` con DMARC).
3. Publica los DNS en tu proveedor (Cloudflare/GoDaddy/etc.).
4. En Resend, presiona **Verify**. Una vez verde, ya puedes usar `from: <usuario>@ese-dominio` desde el SDK.

> Mientras no haya dominio verificado, Resend solo permite enviar a la dirección registrada en tu cuenta usando `onboarding@resend.dev`. Sirve para probar pero **no es opción para la feria**.

## Probar los 3 casos del endpoint

Reemplaza `<KEY>` por tu `ANCOME_SECRET_KEY`.

### 1) Sin secret key → debe fallar 401
```bash
curl -i -X POST http://localhost:3000/api/diagnostico/generar-reporte \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2) Con secret key + body inválido → debe fallar 400
```bash
curl -i -X POST http://localhost:3000/api/diagnostico/generar-reporte \
  -H "Content-Type: application/json" \
  -H "x-ancome-secret-key: <KEY>" \
  -d '{}'
```

### 3) Con secret key + body válido → 200, correo enviado
```bash
curl -X POST http://localhost:3000/api/diagnostico/generar-reporte \
  -H "Content-Type: application/json" \
  -H "x-ancome-secret-key: <KEY>" \
  -d '{
    "respuestas": {
      "q1_rol_empresa": "Contratista de operación (obra minera, acarreo)",
      "q2_tamano_operacion": "Entre 30 y 80 personas",
      "q3_prioridad_automatizacion": "El control y entrega de equipo de protección personal",
      "q4_velocidad_respuesta": "La tenemos, pero nos toma un rato encontrarla",
      "q5_stack_registros": "Mezcla de papel y Excel/WhatsApp",
      "q6_dolor_administrativo": "Armar evidencia cuando la piden de urgencia",
      "q7_temperatura_adopcion": "Me interesaría mucho, queremos modernizarnos"
    },
    "datosContacto": {
      "nombre": "Juan Ramírez",
      "correo": "tu_correo_real@gmail.com",
      "empresa": "Contratista Demo SA",
      "puesto": "Gerente de operaciones",
      "autorizaContacto": true
    }
  }'
```

Logs esperados en consola del server (orden):
1. `[DiagnosticoService] Procesando diagnóstico para visitante: JR`
2. `[DeepseekService] Generando reporte para visitante: JR`
3. `[DeepseekService] Reporte generado — modelo=deepseek-v4-pro total_tokens=… completion_tokens=… finish_reason=stop`
4. `[PdfService] PDF generado — tamaño: ~90 KB`
5. `[EmailService] Correo enviado — id=… a=tu***@gmail.com`
6. `[DiagnosticoService] Diagnóstico completo — visitante=JR envio=…`

## Próximos pasos para producción

1. **Verificar dominio en Resend** (si aún no) y poner `RESEND_FROM_EMAIL` con ese dominio.
2. **Generar y rotar** el `ANCOME_SECRET_KEY`. Configurarlo en el host (Railway/Render/Fly.io/Docker) y en la app móvil.
3. **Ajustar `ALLOWED_ORIGINS`** a las URLs/IPs públicas reales que la app móvil va a usar (no dejar `localhost`).
4. **Build de la imagen Docker** (`docker build -t ancome-backend .`) y deploy en el host de tu preferencia. La imagen ya viene con Chromium del sistema; no descarga nada en runtime.
5. **Revisar el plan de Resend** — el plan free tiene cuota mensual y rate limit (~100 emails/día). Para una feria con tráfico alto, considera el plan pago.
6. **Logs y monitoring**: el log estructurado de Nest es suficiente para una feria de 1 día. Para producción real, capturar a un drain (Logtail/Datadog) y observar la latencia de DeepSeek.
7. **Considerar caché de Chromium** entre builds en el host (Puppeteer descarga ~300 MB la primera vez si no está la imagen Docker).
8. **HTTPS**: el backend escucha HTTP plano. Termina TLS en el reverse proxy del host (Railway/Render/Fly lo hacen automático; si despliegas en VM expuesta, usa Caddy o Nginx).
