import { ConfigWatcherOptions } from './types';
export declare class ConfigWatcher {
    private readonly configs;
    private readonly tableName;
    private readonly namespace;
    private readonly notificationChannel;
    private readonly client;
    private _isReady;
    constructor(options: ConfigWatcherOptions);
    get isReady(): boolean;
    list(): object;
    initialize(): Promise<void>;
    get(key: string): string | undefined;
    set(key: string, value: string): Promise<void>;
    private onNotification;
    private createTable;
    private createNotifyFn;
    private createTrigger;
    private listen;
    private setConfig;
    private removeConfig;
    private loadConfigs;
}
