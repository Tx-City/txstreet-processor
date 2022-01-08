import redis from 'redis';
import { promisify } from "util";

let client: any = null; 

if(process.env.USE_DATABASE === "true") {
    client = redis.createClient({
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASS 
    });
    client.getAsync = promisify(client.get).bind(client);
    client.setAsync = promisify(client.set).bind(client);
}

export default client; 