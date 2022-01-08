import redis from 'redis';
import fs from 'fs';
import path from 'path';
import { Logger } from '../../../lib/utilities';

const subscriber = redis.createClient({
    port: parseInt(process.env.REDIS_PORT),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD
});

const handlerPath = path.join(__dirname, 'handlers'); 
const handlers: any = {}; 
const files: string[] = fs.readdirSync(handlerPath); 
const run = async () => {
    files.forEach(async filename => {
        if(!filename.includes('.js')) return; 
        if(filename.includes('.map')) return; 
        const realname = filename.replace('.js', '');
        const importPath = path.join(__dirname, 'handlers', filename); 
        const handler = await import(importPath); 
        handlers[realname] = handler.default; 
    });
}
run(); 

// Register a dynamic subscription for subscriptions.
subscriber.on('subscribe', (channel: string, count: number) => {}); 

// Register a dynamic subscription for messages.
subscriber.on('message', (channel: string, messageStr: string) => {
    try {
        const message = JSON.parse(messageStr); 
        const handler = handlers[channel]; 
        if(handler) handler(message); 
    } catch (error) {
        Logger.error(error);
    }
});

export default subscriber; 