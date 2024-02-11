import { z } from 'zod';
import 'dotenv/config';

const config = z
  .object({
    LINODE_ACCESS_TOKEN: z.string().trim().min(1),
    LINODE_DOMAIN_ID: z.coerce.number().gt(0),
    HOSTNAMES: z.preprocess(
      (value) => (value ? new Set(JSON.parse(value as string)) : undefined),
      z.set(z.string()).optional(),
    ),
    RECORD_TYPES: z.preprocess(
      (value) => (value ? new Set(JSON.parse(value as string)) : undefined),
      z.set(z.enum(['A', 'AAAA'])).optional(),
    ),
    CRON_TIME: z.preprocess(
      (value) => value || undefined,
      z.string().trim().default('*/10 * * * *'),
    ),
    LOG_LEVEL: z.preprocess(
      (value) => value || undefined,
      z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),
    ),
  })
  .strip()
  .safeParse(process.env);

if (!config.success) {
  throw config.error.issues;
}

export default config.data;
