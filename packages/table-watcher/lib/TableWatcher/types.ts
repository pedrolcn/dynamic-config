import { ClientConfig } from 'pg';

export enum TableEvents {
  UPDATE = 'UPDATE',
  INSERT = 'INSERT',
  DELETE = 'DELETE'
}

export interface NotificationPayload<Schema> {
  operation: 'UPDATE' | 'CREATE' | 'DELETE',
  record: Schema;
}

export interface TableWatcherOptions {
  db: ClientConfig
  table: string;
  events?: TableEvents[];
  notificationChannel?: string;
}