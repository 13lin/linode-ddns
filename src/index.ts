import {
  DomainRecord,
  getDomain,
  getDomainRecords,
  setToken,
  updateDomainRecord,
} from '@linode/api-v4';
import { CronJob } from 'cron';
import { pino } from 'pino';

import Config from './config';

const logger = pino({ level: Config.LOG_LEVEL });

const fetchIpv4 = () =>
  fetch('https://ipv4.icanhazip.com')
    .then((res) => res.text())
    .then((ip) => ip.trim())
    .catch((err) => {
      logger.error(
        err,
        `Failed to retrieve IPv4 address: ${(<Error>err).message}.`,
      );
      return Promise.resolve();
    });

const fetchIpv6 = () =>
  fetch('https://ipv6.icanhazip.com')
    .then((res) => res.text())
    .then((ip) => ip.trim())
    .catch((err: unknown) => {
      logger.error(
        err,
        `Failed to retrieve IPv6 address: ${(<Error>err).message}.`,
      );
      return Promise.resolve();
    });

const getIp = async () => {
  logger.debug('Getting IP address from icanhazip.com...');

  const tasks = [];
  if (!Config.RECORD_TYPES) {
    tasks.push(fetchIpv4(), fetchIpv6());
  } else {
    if (Config.RECORD_TYPES.has('A')) {
      tasks.push(fetchIpv4());
    }

    if (Config.RECORD_TYPES.has('AAAA')) {
      tasks.push(fetchIpv6());
    }
  }

  return await Promise.all(tasks);
};

const getDomainRecordDisplayName = (record: DomainRecord) =>
  `${record.type} Record ${record.name || '@'}`;

const updateDomainRecordsIp = async () => {
  const [ipv4, ipv6] = await getIp();
  const loggerWithIp = logger.child({
    action: updateDomainRecordsIp.name,
    ipv4,
    ipv6,
  });

  const domain = await getDomain(Config.LINODE_DOMAIN_ID);
  logger.info(`Getting domain records for ${domain.domain}...`);

  const records = await getDomainRecords(Config.LINODE_DOMAIN_ID);
  const recordsToUpdate = records.data.reduce(
    (results, record) => {
      const typeAndName = getDomainRecordDisplayName(record);

      if (Config.HOSTNAMES && !Config.HOSTNAMES.has(record.name)) {
        loggerWithIp.debug(
          {
            record: {
              type: record.type,
              hostname: record.name,
              ip: record.target,
            },
          },
          `Skipping ${typeAndName} as it is not in the provided hostnames.`,
        );
        return results;
      }

      if (ipv4 && record.type === 'A' && record.target !== ipv4) {
        loggerWithIp.debug(
          `Current ${typeAndName} target value is ${record.target}.`,
        );
        results.push({ ...record, newTarget: ipv4 });
      } else if (ipv6 && record.type === 'AAAA' && record.target !== ipv6) {
        loggerWithIp.debug(
          `Current ${typeAndName} target value is ${record.target}.`,
        );
        results.push({ ...record, newTarget: ipv6 });
      }

      return results;
    },
    <(DomainRecord & { newTarget: string })[]>[],
  );

  recordsToUpdate.length
    ? loggerWithIp.info(
        recordsToUpdate.map((record) => ({
          type: record.type,
          hostname: record.name,
          ip: record.target,
          newIp: record.newTarget,
        })),
        `${recordsToUpdate.length} domain records will be updated.`,
      )
    : loggerWithIp.info('No records require to update.');

  for (let record of recordsToUpdate) {
    const typeAndName = getDomainRecordDisplayName(record);

    loggerWithIp.info(`Updating ${typeAndName} target to ${record.newTarget}.`);

    try {
      await updateDomainRecord(Config.LINODE_DOMAIN_ID, record.id, {
        id: record.id,
        target: record.newTarget,
      });
    } catch (err: unknown) {
      loggerWithIp.error(
        err,
        `Failed to update ${typeAndName} target: ${(<Error>err).message}.`,
      );
    }
  }
};

const cron = new CronJob(Config.CRON_TIME, async () => {
  try {
    await updateDomainRecordsIp();
  } catch (err: unknown) {
    logger.error(
      err,
      `Failed to update domain records IP: ${(<Error>err).message}.`,
    );
  }
});

setToken(Config.LINODE_ACCESS_TOKEN);

logger.info('Starting Linode dynamic DNS updater cron job...');
logger.debug(
  {
    ...Config,
    HOSTNAMES: Config.HOSTNAMES ? [...Config.HOSTNAMES] : undefined,
    RECORD_TYPES: Config.RECORD_TYPES ? [...Config.RECORD_TYPES] : undefined,
  },
  'Configuration',
);
cron.start();
