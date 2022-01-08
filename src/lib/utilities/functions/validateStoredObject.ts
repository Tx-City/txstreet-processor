import { Logger } from '..';

export default async (chain: string, hash: string) => {
    Logger.warn(`Using deprecated method "validateStoredObject".`);
}
