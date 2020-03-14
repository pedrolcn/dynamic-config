import { LoggerInstance } from 'nano-errors';
import { ClientConfig } from 'pg';

export interface ConfigWatcherOptions {
  db: ClientConfig;
  logger: LoggerInstance;
  tableName?: string;
  namespace?: string;
  notificationChannel?: string;
}

export interface ConfigSchema {
  namespace: string;
  key: string;
  value: string;
}

export interface ConfigChangeNotificationPayload {
  operation: 'UPDATE' | 'CREATE' | 'DELETE',
  record: ConfigSchema;
}