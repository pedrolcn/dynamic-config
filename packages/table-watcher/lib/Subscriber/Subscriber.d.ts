import { NotificationPayload } from '../TableWatcher/types';
export declare abstract class Subscriber<Schema> {
    abstract notify(notification: NotificationPayload<Schema>): Promise<void>;
}
