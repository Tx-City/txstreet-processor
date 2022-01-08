
import fs from 'fs';
import path from 'path'; 

const dataDir = process.env.DATA_DIR || '/mnt/disks/txstreet_storage'

export default async (relativePath: string, contents: Buffer | string) => {
    const rand = (Math.random() + 1).toString(36).substring(7);
    const finalPath = path.join(dataDir, relativePath);
    const writingFilePath = finalPath + "." + rand;
    await fs.promises.writeFile(writingFilePath, contents);
    await fs.promises.rename(writingFilePath, finalPath);
}
