import { NotificationPayload } from '../TableWatcher/types';

export abstract class Subscriber<Schema> {
  public abstract notify(notification: NotificationPayload<Schema>): Promise<void>; 
}