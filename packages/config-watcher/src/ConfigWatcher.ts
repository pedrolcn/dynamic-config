import { Client, Notification } from 'pg';
import { DEFAULT_TABLE_NAME, DEFAULT_NAMESPACE, DEFAULT_NOTIFICATION_CHANNEL } from './constants';
import { ConfigSchema, ConfigChangeNotificationPayload, ConfigWatcherOptions } from './types';

export class ConfigWatcher {
  private readonly configs = new Map<string, string>();

  private readonly tableName: string;

  private readonly namespace: string;

  private readonly notificationChannel: string;

  private readonly client: Client;

  private _isReady: boolean = false;

  constructor(options: ConfigWatcherOptions) {
    this.client = new Client(options.db);

    this.tableName = options.tableName ?? DEFAULT_TABLE_NAME;
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE;
    this.notificationChannel = options.notificationChannel ?? DEFAULT_NOTIFICATION_CHANNEL;
  }

  public get isReady() {
    return this._isReady;
  }

  public list(): object {
    return Object.fromEntries(this.configs.entries());
  }

  public async initialize(): Promise<void> {
    await this.client.connect();
    this.client.on('notification', this.onNotification.bind(this));

    await this.createNotifyFn();
    await this.createTable();
    await this.createTrigger();
    await this.loadConfigs();
    await this.listen();

    this._isReady = true;
  }

  public get(key: string): string | undefined {
    return this.configs.get(key);
  }

  public async set(key: string, value: string): Promise<void> {
    await this.client.query(`
INSERT INTO "${this.tableName}" (namespace, key, value)
VALUES ('${this.namespace}', $1, $2)
ON CONFLICT (namespace, key)
DO UPDATE SET value=$2`, [key, value]);
  }

  // ==============================================================================================
  // #                                    PRIVATE METHODS                                         #
  // ==============================================================================================

  private async onNotification(message: Notification) {
    if (message.channel !== this.notificationChannel || !message.payload) return;
    const payload: ConfigChangeNotificationPayload = JSON.parse(message.payload!);

    if (payload.record.namespace !== this.namespace) return; 

    if (payload.operation === 'DELETE') {
      this.removeConfig(payload.record);
    } else {
      this.setConfig(payload.record);
    }

    console.log(`Got event ${payload.operation} with data ${JSON.stringify(payload.record)}`);
    console.log(JSON.stringify(this.list(), undefined, 2));
  }

  private async createTable() {
    return this.client.query(`
CREATE TABLE IF NOT EXISTS "${this.tableName}" (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(namespace, key)
)`);
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
    await this.client.query(`DROP TRIGGER IF EXISTS configs_changed on "${this.tableName}"`);
    return this.client.query(`
CREATE TRIGGER configs_changed
AFTER INSERT OR UPDATE OR DELETE
ON "${this.tableName}"
FOR EACH ROW
EXECUTE PROCEDURE notify_changes()`);
  }

  private async listen() {
    await this.client.query(`LISTEN "${this.notificationChannel}"`);
  }

  private setConfig(payload: ConfigSchema) {
    this.configs.set(payload.key, payload.value);    
  }

  private removeConfig(payload: ConfigSchema) {
    this.configs.delete(payload.key);
  }

  private async loadConfigs() {
    const { rows } = await this.client.query<ConfigSchema>(`SELECT "${this.tableName}"."namespace" AS "namespace", "${this.tableName}"."key" AS "key", "${this.tableName}"."value" AS "value" FROM "${this.tableName}" WHERE "${this.tableName}"."namespace" = $1`, [this.namespace]);
    for (const row of rows) {
      this.setConfig(row);
    }

    console.log(JSON.stringify(this.list(), undefined, 4));
  }
}
