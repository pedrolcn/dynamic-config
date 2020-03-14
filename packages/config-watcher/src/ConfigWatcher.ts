import { Client } from 'pg';
import { Subscriber, NotificationPayload, TableWatcher } from 'table-watcher';
import { DEFAULT_TABLE_NAME, DEFAULT_NAMESPACE } from './constants';
import { ConfigSchema, ConfigWatcherOptions } from './types';

export class ConfigWatcher extends Subscriber<ConfigSchema> {
  private readonly configs = new Map<string, string>();

  private readonly tableName: string;

  private readonly tableWatcher: TableWatcher;

  private readonly namespace: string;

  private readonly client: Client;

  private _isReady: boolean = false;

  constructor(options: ConfigWatcherOptions) {
    super();
    this.tableName = options.table ?? DEFAULT_TABLE_NAME;
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE;

    this.client = new Client(options.db);
    
    this.tableWatcher = new TableWatcher({
      client: this.client,
      table: this.tableName,
      notificationChannel: options.notificationChannel,
    });
  }

  public get isReady() {
    return this._isReady;
  }

  public get table() {
    return this.tableName;
  }

  public list(): object {
    return Object.fromEntries(this.configs.entries());
  }

  public async initialize(): Promise<void> {
    await this.loadConfigs();
    this.tableWatcher.subscribe(this);

    this._isReady = true;
  }

  public async build(): Promise<void> {
    await this.createTable();
    await this.tableWatcher.build();
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

  public async notify(message: NotificationPayload<ConfigSchema>) {
    if (message.record.namespace !== this.namespace) return; 

    if (message.operation === 'DELETE') {
      this.removeConfig(message.record);
    } else {
      this.setConfig(message.record);
    }

    console.log(`Got event ${message.operation} with data ${JSON.stringify(message.record)}`);
    console.log(JSON.stringify(this.list(), undefined, 2));
  }

  // ==============================================================================================
  // #                                    PRIVATE METHODS                                         #
  // ==============================================================================================
  private async createTable() {
    return this.client.query(`
CREATE TABLE IF NOT EXISTS "${this.tableName}" (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(namespace, key)
)`);
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
