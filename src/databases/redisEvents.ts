import { Logger } from '../lib/utilities';
import EventEmitter from 'eventemitter3'; 
import redis from 'redis';

const publisher = redis.createClient({
    port: parseInt(process.env.REDIS_PORT || '6379'),
    host: process.env.REDIS_HOST
});

const subscriber = redis.createClient({
    port: parseInt(process.env.REDIS_PORT || '6379'),
    host: process.env.REDIS_HOST
});

const on = (key: string, callback: any) => {
    subscriber.on(key, callback); 
}

const unsubscribe = (key: string) => {
    subscriber.unsubscribe(key); 
}

const subscribe = (key: string) => {
    subscriber.subscribe(key); 
}

const publish = (key: string, value: string | object) => {
    if(typeof value === "object")
        value = JSON.stringify(value);
    publisher.publish(key, value); 
}

const events = new EventEmitter(); 

subscriber.on('message', (channel: string, messageStr: string) => {
    try {
        const message = JSON.parse(messageStr); 
        events.emit(channel, message); 
    } catch (error) {
        Logger.error(error);
    }
});


export default {
    on,
    unsubscribe,
    subscribe,
    publish, 
    events
}