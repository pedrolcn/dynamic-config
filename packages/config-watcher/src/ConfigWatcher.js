"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const constants_1 = require("./constants");
class ConfigWatcher {
    constructor(options) {
        var _a, _b, _c;
        this.configs = new Map();
        this._isReady = false;
        this.client = new pg_1.Client(options.db);
        this.tableName = (_a = options.tableName) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_TABLE_NAME;
        this.namespace = (_b = options.namespace) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_NAMESPACE;
        this.notificationChannel = (_c = options.notificationChannel) !== null && _c !== void 0 ? _c : constants_1.DEFAULT_NOTIFICATION_CHANNEL;
    }
    get isReady() {
        return this._isReady;
    }
    list() {
        return Object.fromEntries(this.configs.entries());
    }
    async initialize() {
        await this.client.connect();
        this.client.on('notification', this.onNotification.bind(this));
        await this.createNotifyFn();
        await this.createTable();
        await this.createTrigger();
        await this.loadConfigs();
        await this.listen();
        this._isReady = true;
    }
    get(key) {
        return this.configs.get(key);
    }
    async set(key, value) {
        await this.client.query(`
INSERT INTO "${this.tableName}" (namespace, key, value)
VALUES ('${this.namespace}', $1, $2)
ON CONFLICT (namespace, key)
DO UPDATE SET value=$2`, [key, value]);
    }
    // ==============================================================================================
    // #                                    PRIVATE METHODS                                         #
    // ==============================================================================================
    async onNotification(message) {
        if (message.channel !== this.notificationChannel || !message.payload)
            return;
        const payload = JSON.parse(message.payload);
        if (payload.record.namespace !== this.namespace)
            return;
        if (payload.operation === 'DELETE') {
            this.removeConfig(payload.record);
        }
        else {
            this.setConfig(payload.record);
        }
        console.log(`Got event ${payload.operation} with data ${JSON.stringify(payload.record)}`);
        console.log(JSON.stringify(this.list(), undefined, 2));
    }
    async createTable() {
        return this.client.query(`
CREATE TABLE IF NOT EXISTS "${this.tableName}" (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(namespace, key)
)`);
    }
    async createNotifyFn() {
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
    async createTrigger() {
        await this.client.query(`DROP TRIGGER IF EXISTS configs_changed on "${this.tableName}"`);
        return this.client.query(`
CREATE TRIGGER configs_changed
AFTER INSERT OR UPDATE OR DELETE
ON "${this.tableName}"
FOR EACH ROW
EXECUTE PROCEDURE notify_changes()`);
    }
    async listen() {
        await this.client.query(`LISTEN "${this.notificationChannel}"`);
    }
    setConfig(payload) {
        this.configs.set(payload.key, payload.value);
    }
    removeConfig(payload) {
        this.configs.delete(payload.key);
    }
    async loadConfigs() {
        const { rows } = await this.client.query(`SELECT "${this.tableName}"."namespace" AS "namespace", "${this.tableName}"."key" AS "key", "${this.tableName}"."value" AS "value" FROM "${this.tableName}" WHERE "${this.tableName}"."namespace" = $1`, [this.namespace]);
        for (const row of rows) {
            this.setConfig(row);
        }
        console.log(JSON.stringify(this.list(), undefined, 4));
    }
}
exports.ConfigWatcher = ConfigWatcher;
//# sourceMappingURL=ConfigWatcher.js.map