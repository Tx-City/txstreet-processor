import fs from 'fs'; // Use standard fs for synchronous file operations
import path from 'path';
import mongodb from '../../../databases/mongodb';

// TODO: Create .json file and store it in spaces
export default async (chain: string, wikiname: string): Promise<void> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('houses');
        
        const dir = path.join(process.env.WIKI_DIR as string, wikiname, 'houses');
        console.log("dir---------->", process.env.WIKI_DIR);
        const files = fs.readdirSync(dir).filter((file: string) => file.includes('.json'));

        const writeInstructions: any[] = [];

        // Create a function to read JSON files
        function readJsonFile(filename: any) {
            console.log("are you reading json data")
            try {
                const fileContent = fs.readFileSync(path.join(dir, filename), 'utf8');
                const data = JSON.parse(fileContent);
                return data;
            } catch (error) {
                console.error("Error reading JSON file:", error);
                return null;
            }
        }

        // Iterate over the filenames and read the JSON content
        for (const filename of files) {
            console.log("filename", filename);
            const data = readJsonFile(filename);
            if (data) {
                console.log("data", data);

                if (data.contracts) data.contracts = data.contracts.map((item: any) => item.address);
                writeInstructions.push({
                    updateOne: {
                        filter: { name: data.name, chain },
                        update: { $set: { popupLength: 75, priority: 0, side: 0, dataSources: ['wiki'], colors: ["eaeaea", "431e9a"], ...data } },
                        upsert: true
                    }
                });
            }
        }

        if (writeInstructions.length > 0) {
            await collection.bulkWrite(writeInstructions);
            console.log("Housing data updated");
        }
    } catch (error) {
        console.error(error);
    }
}
