import redis from '../../databases/redis';

// This function is used to ensure that multiple nodes cannot process the same transaction
// by using REDIS with the EX (Expire) and NX(Not Exists) arguments we can ensure that
// another node has not already begun processing this hash.
export default async (chain: string, hash: string): Promise<Boolean> => {
    try {
        if (process.env.USE_DATABASE !== "true")
            return true;

        console.log('hash:', hash);
        const rcall = await redis.setAsync(`${chain}-tx-${hash}`, '1', 'NX', 'EX', 60 * 1);
        console.log('checking redis:', rcall);
        return rcall
    } catch (error) {
        console.error(error);
    }

    console.log('its just returning false');

    return false;
}