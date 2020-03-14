import { ClientConfig, Client } from 'pg';

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
  db?: ClientConfig
  client?: Client;
  table: string;
  events?: TableEvents[];
  notificationChannel?: string;
}