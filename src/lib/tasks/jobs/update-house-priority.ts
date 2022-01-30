import { Logger, storeObject } from '../../../lib/utilities';
import mongodb from '../../../databases/mongodb';
import path from 'path';

export default async(chain: string): Promise<void> => {
    try {
        const { database } = await mongodb(); 
        const houses = await database.collection(process.env.DB_COLLECTION_HOUSES as string).find({ chain }).toArray(); 

        const tasks: Promise<any>[] = [];
        const houseData: any[] = []; 
        houses.forEach((house: any) => {
            const task = async (): Promise<any> => {
                try {
                    const collection = database.collection(process.env.DB_COLLECTION_TRANSACTIONS + '_' + chain);
                    const fiveMinutesAgo = Date.now() - 300000;
                    const priority = await collection.find({ processed: true, house: house.name, timestamp: { $gte: fiveMinutesAgo } }).count(); 

                    const object = {
                        name: house.name,
                        title: house.title,
                        dataSources: house.dataSources || ['wiki'],
                        popupLength: house.popupLength || 75,
                        colors: house.colors, 
                        side: house.side || 0,
                        priority,
                        tracked: house.tracked || false 
                    }

                    houseData.push(object); 
                    return true; 
                } catch (error) {
                    return false;
                }
            }
            tasks.push(task());
        });
        await Promise.all(tasks); 
        await storeObject(path.join('live', `houses-${chain}`), JSON.stringify(houseData)); 
    } catch (error) {
        Logger.error(error);
    }
}

