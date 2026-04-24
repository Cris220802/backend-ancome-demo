import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  NODE_ENV: Joi.string()
    .valid('development', 'production')
    .default('development'),

  ANCOME_SECRET_KEY: Joi.string().min(32).required(),

  ALLOWED_ORIGINS: Joi.string().required(),

  ANTHROPIC_API_KEY: Joi.string().required(),
  ANTHROPIC_MODEL: Joi.string().default('claude-sonnet-4-6'),

  RESEND_API_KEY: Joi.string().required(),
  RESEND_FROM_EMAIL: Joi.string().email().required(),
  RESEND_FROM_NAME: Joi.string().required(),

  REPORT_SUBJECT: Joi.string().required(),
});
