import mongodb from '../../../databases/mongodb';
import { ObjectId } from 'mongodb';
export default async (): Promise<void> => {

    const chain = "BTC";
    const houseIdToRemove = new ObjectId("652f7c694ed55530c7b87daf");
    console.log(`removing house with ID: ${houseIdToRemove}`);

    try {
        const { database } = await mongodb();

        const houses = await database.collection('houses')
        const allHouses = await houses.find({ chain }).toArray();

        console.log('houses in db:', allHouses);

        // Find and remove the house with the specified ID
        const result = await database.collection('houses').findOneAndDelete({ _id: houseIdToRemove, chain });

        console.log("result", result);


        if (result.value) {
            console.log(`House with ID ${houseIdToRemove} removed successfully.`);
        } else {
            console.log(`House with ID ${houseIdToRemove} not found.`);
        }

        // You may want to update other parts of your logic based on your requirements.

    } catch (error) {
        console.error(error);
    }
}
