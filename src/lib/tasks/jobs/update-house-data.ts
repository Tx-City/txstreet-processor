import { Logger } from '../../../lib/utilities';
import fs from 'fs';
import path from 'path'; 
import mongodb from '../../../databases/mongodb';


// TODO: Create .json file and store it in spaces
export default async(chain: string, wikiname: string): Promise<void> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection(process.env.DB_COLLECTION_HOUSES as string); 
        const dir = path.join(process.env.WIKI_DIR as string, wikiname, 'houses'); 
        const files = fs.readdirSync(dir).filter((file: string) => file.includes('.json'));

        const tasks: Promise<any>[] = [];
        const writeInstructions: any[] = [];
        files.forEach((filename: string) => {
            tasks.push(new Promise(async (resolve) => {
                const data = (await import(path.join(dir, filename))).default; 
                if(data.contracts) 
                    data.contracts = data.contracts.map((item: any) => item.address);
                writeInstructions.push({
                    updateOne: {
                        filter: { name: data.name, chain },
                        update: { $set: { popupLength: 75, priority: 0, side: 0, dataSources: ['wiki'], ...data  } },
                        upsert: true 
                    }
                })

                resolve(true);
            }));
        })

        writeInstructions.push({
            updateOne: {
                filter: { name: 'donation', chain: 'BCH' },
                update: { $set: { popupLength: 300, priority: 1000000, side: 1, dataSources: ['html'], tracked: true, colors: ["ae2121", "lighten"], title: 'Donate to TxStreet' } },
                upsert: true
            }
        });

        writeInstructions.push({
            updateOne: {
                filter: { name: 'donation', chain: 'ETH' },
                update: { $set: { popupLength: 300, priority: 1000000, side: 1, dataSources: ['html'], tracked: true, colors: ["ae2121", "lighten"], title: 'Donate to TxStreet' } },
                upsert: true
            }
        });

        writeInstructions.push({
            updateOne: {
                filter: { name: 'donation', chain: 'BTC' },
                update: { $set: { popupLength: 300, priority: 1000000, side: 1, dataSources: ['html'], tracked: true, colors: ["ae2121", "lighten"], title: 'Donate to TxStreet' } },
                upsert: true
            }
        });

        writeInstructions.push({
            updateOne: {
                filter: { name: 'donation', chain: 'LTC' },
                update: { $set: { popupLength: 300, priority: 1000000, side: 1, dataSources: ['html'], tracked: true, colors: ["ae2121", "lighten"], title: 'Donate to TxStreet' } },
                upsert: true
            }
        });

        await Promise.all(tasks); 

        if(writeInstructions.length > 0) 
            await collection.bulkWrite(writeInstructions); 

        Logger.info("Housing data updated");

    } catch (error) {
        Logger.error(error);
    }
}