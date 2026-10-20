import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .default(5000),

  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .default("mongodb://127.0.0.1:27017/fair_drop"),

  REDIS_HOST: z
    .string()
    .default("localhost"),

  REDIS_PORT: z.coerce
    .number()
    .default(6379),

  FRONTEND_URL: z
    .string()
    .default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").default("development-secret-key-change-me-1234567890"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  COOKIE_NAME: z.string().default("fair_drop_token")
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment variables:");
  console.error(result.error.flatten().fieldErrors);

  process.exit(1);
}

export const env = result.data;