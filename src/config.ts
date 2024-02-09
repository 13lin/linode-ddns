import { RecordType } from '@linode/api-v4';
import Joi from 'joi';
import 'dotenv/config';

export interface Config {
  LINODE_ACCESS_TOKEN: string;
  LINODE_DOMAIN_ID: number;
  HOSTNAMES?: Set<string>;
  RECORD_TYPES?: Set<Extract<RecordType, 'A' | 'AAAA'>>;
  CRON_TIME: string;
  LOG_LEVEL: string;
}

const schema = Joi.object<Config>({
  LINODE_ACCESS_TOKEN: Joi.string().required(),
  LINODE_DOMAIN_ID: Joi.string().required(),
  HOSTNAMES: Joi.string().empty('').optional(),
  RECORD_TYPES: Joi.string().empty('').optional(),
  CRON_TIME: Joi.string().empty('').default('*/10 * * * *'),
  LOG_LEVEL: Joi.string().empty('').default('info'),
});

const result = schema.validate(process.env, {
  abortEarly: true,
  stripUnknown: true,
});

if (result.error) {
  throw result.error;
}

if (process.env.HOSTNAMES) {
  try {
    result.value.HOSTNAMES = new Set(JSON.parse(process.env.HOSTNAMES));
  } catch (cause: unknown) {
    throw new Error(`Cannot parse HOSTNAMES: ${process.env.HOSTNAMES}.`, {
      cause,
    });
  }
}

if (process.env.RECORD_TYPES) {
  let types: [];
  try {
    types = JSON.parse(process.env.RECORD_TYPES);
  } catch (cause: unknown) {
    throw new Error(`Cannot parse RECORD_TYPES: ${process.env.RECORD_TYPES}.`, {
      cause,
    });
  }

  if (!types.length) {
    throw new Error('Please specific record types to update.');
  }

  if (types.some((type) => type !== 'A' && type !== 'AAAA')) {
    throw new Error('Only A and AAAA record types are supported.');
  }

  result.value.RECORD_TYPES = new Set(types);
}

export default result.value;
