import { Client, Notification } from 'pg';
import { TableWatcherOptions, TableEvents, NotificationPayload } from './types';
import { DEFAULT_TABLE_EVENTS } from './constants';
import { Subscriber } from '../Subscriber/Subscriber';

export class TableWatcher<Schema = any> {
  private readonly tableName: string;

  private readonly notificationChannel: string;

  private readonly client: Client;

  private readonly events: TableEvents[];

  private subscribers: Map<string, Subscriber<Schema>> = new Map();

  private _isReady: boolean = false;

  constructor(options: TableWatcherOptions) {
    if (!options.db && !options.client) {
      throw new Error("Either database connection options or a client must be passed to tableWatcher");
    }

    this.client = options.client ? options.client : new Client(options.db);

    this.tableName = options.table;
    this.events = options.events || DEFAULT_TABLE_EVENTS;
    this.notificationChannel = options.notificationChannel || `${options.table}_notifications`;
  }

  public get isReady() {
    return this._isReady;
  }

  public subscribe(subscriber: Subscriber<Schema>): () => void {
    this.subscribers.set(subscriber.constructor.name, subscriber);
    return () => this.subscribers.delete(subscriber.constructor.name);
  }

  public async initialize(): Promise<void> {
    await this.client.connect();
    this.client.on('notification', this.onNotification.bind(this));

    await this.listen();
    this._isReady = true;
  }

  public async build() {
    await this.createNotifyFn();
    await this.createTrigger();
  }

  // ==============================================================================================
  // #                                    PRIVATE METHODS                                         #
  // ==============================================================================================
  private async onNotification(message: Notification) {
    const payload: NotificationPayload<Schema> = JSON.parse(message.payload!);
    await Promise.all(
      Array.from(
        this.subscribers.values()
      ).map(subscriber => subscriber.notify(payload))
    );
  }

  private async createNotifyFn() {
    return this.client.query(`
CREATE OR REPLACE FUNCTION notify_changes()
RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
      PERFORM pg_notify(
        '${this.notificationChannel}',
        json_build_object(
          'operation', TG_OP,
          'record', row_to_json(OLD)
        )::text
      );

      RETURN OLD;
    ELSE 
      PERFORM pg_notify(
        '${this.notificationChannel}',
        json_build_object(
          'operation', TG_OP,
          'record', row_to_json(NEW)
        )::text
      );

      RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql`); 
  }

  private async createTrigger() {
    await this.client.query(`DROP TRIGGER IF EXISTS table_changed on "${this.tableName}"`);
    return this.client.query(`
CREATE TRIGGER table_changed
AFTER ${this.events.join(' OR ')}
ON "${this.tableName}"
FOR EACH ROW
EXECUTE PROCEDURE notify_changes()`);
  }

  private async listen() {
    await this.client.query(`LISTEN "${this.notificationChannel}"`);
  }
}
