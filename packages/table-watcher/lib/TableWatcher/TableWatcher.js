"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const constants_1 = require("./constants");
class TableWatcher {
    constructor(options) {
        this.subscribers = new Map();
        this._isReady = false;
        this.client = new pg_1.Client(options.db);
        this.tableName = options.table;
        this.events = options.events || constants_1.DEFAULT_TABLE_EVENTS;
        this.notificationChannel = options.notificationChannel || `${options.table}_notifications`;
    }
    get isReady() {
        return this._isReady;
    }
    subscribe(subscriber) {
        this.subscribers.set(subscriber.constructor.name, subscriber);
        return () => this.subscribers.delete(subscriber.constructor.name);
    }
    async initialize() {
        await this.client.connect();
        this.client.on('notification', this.onNotification.bind(this));
        await this.listen();
        this._isReady = true;
    }
    async build() {
        await this.createNotifyFn();
        await this.createTrigger();
    }
    // ==============================================================================================
    // #                                    PRIVATE METHODS                                         #
    // ==============================================================================================
    async onNotification(message) {
        const payload = JSON.parse(message.payload);
        await Promise.all(Array.from(this.subscribers.values()).map(subscriber => subscriber.notify(payload)));
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
        await this.client.query(`DROP TRIGGER IF EXISTS table_changed on "${this.tableName}"`);
        return this.client.query(`
CREATE TRIGGER table_changed
AFTER ${this.events.join(' OR ')}
ON "${this.tableName}"
FOR EACH ROW
EXECUTE PROCEDURE notify_changes()`);
    }
    async listen() {
        await this.client.query(`LISTEN "${this.notificationChannel}"`);
    }
}
exports.TableWatcher = TableWatcher;
//# sourceMappingURL=TableWatcher.js.map