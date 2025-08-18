import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'VITE_',

  client: {
    VITE_API_URL: z.string().url(),
    VITE_APP_NAME: z.string(),

    VITE_PUSHER_APP_ID: z.string(),
    VITE_PUSHER_APP_KEY: z.string(),
    VITE_PUSHER_APP_SECRET: z.string(),
    VITE_PUSHER_HOST: z.string(),
    VITE_PUSHER_PORT: z.string(),
    VITE_PUSHER_SCHEME: z.string(),
    VITE_PUSHER_APP_CLUSTER: z.string(),

    // VITE_SENTRY_DSN: z
    // 	.string()
    // 	.url()
    // 	.optional()
    // 	.refine((value) => {
    // 		if (import.meta.env.DEV) {
    // 			return true;
    // 		} else {
    // 			return value !== '' && value !== undefined;
    // 		}
    // 	}),

    VITE_WEB_VITALS: z
      .string()
      .refine((s) => s === 'true' || s === 'false')
      .transform((s) => s === 'true'),
    VITE_STANDALONE: z
      .string()
      .refine((s) => s === 'true' || s === 'false')
      .transform((s) => s === 'true'),
    VITE_DEFAULT_DOMAIN: z.string().url(),

    VITE_S3_URL: z.string().url(),
  },

  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});