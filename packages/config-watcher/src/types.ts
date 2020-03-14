import { ClientConfig } from 'pg';

export interface ConfigWatcherOptions {
  db: ClientConfig;
  table?: string;
  namespace?: string;
  notificationChannel?: string;
}

export interface ConfigSchema {
  namespace: string;
  key: string;
  value: string;
}
