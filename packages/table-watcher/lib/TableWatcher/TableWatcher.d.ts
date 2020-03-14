import { TableWatcherOptions } from './types';
import { Subscriber } from '../Subscriber/Subscriber';
export declare class TableWatcher<Schema = any> {
    private readonly tableName;
    private readonly notificationChannel;
    private readonly client;
    private readonly events;
    private subscribers;
    private _isReady;
    constructor(options: TableWatcherOptions);
    get isReady(): boolean;
    subscribe(subscriber: Subscriber<Schema>): () => void;
    initialize(): Promise<void>;
    build(): Promise<void>;
    private onNotification;
    private createNotifyFn;
    private createTrigger;
    private listen;
}
