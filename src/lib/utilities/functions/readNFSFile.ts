import { exec } from 'child_process';
import fs from 'fs';
import { Logger } from '..';

const execPromise = (command: string) => new Promise((resolve, reject) => {
    exec(command, async (error, stdout, stderr) => {
        if(error || stderr) return reject(error || stderr); 
        return resolve(stdout); 
    });
})

export default async (path: string, encoding: string|null = null): Promise<Buffer|string|null> => {
    const config: any = { flag: 'rs' };
    if(encoding) config.encoding = encoding; 
    const data = await fs.promises.readFile(path, config); 
    return data;

    // The below commented code is used to read via FileDescriptor
    /*
    let parts = path.split('/');
    const filename = parts[parts.length - 1]; 
    delete parts[parts.length -1 ];
    let directory = parts.join('/'); 
    const output = await execPromise(`cd ${directory} && find -name ${filename}`); 
    Logger.info(`Command output: ${output}`)
    const fileDescriptor = await fs.promises.open(path, 'rs');
    const stats = await fileDescriptor.stat(); 
    const buffer = Buffer.alloc(stats.size);
    await fileDescriptor.read(buffer, 0, buffer.length, 0);
    fileDescriptor.close().catch(error => Logger.error(error));
    return encoding ? buffer.toString(encoding as BufferEncoding) : buffer; 
    */ 
} 