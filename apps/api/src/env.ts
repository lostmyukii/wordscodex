import 'dotenv/config'
import { z } from 'zod'

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32)
      .default('development-secret-at-least-thirty-two-characters'),
    AUTH_DEV_CODE: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  })
  .refine((value) => value.NODE_ENV !== 'production' || !value.AUTH_DEV_CODE, {
    path: ['AUTH_DEV_CODE'],
    message: 'AUTH_DEV_CODE must not be set in production.',
  })

export const env = envSchema.parse(process.env)
