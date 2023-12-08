import mongodb from '../databases/mongodb';

export default async (): Promise<void> => {

    const chain = "BTC";
    const houseIdToRemove = "";
    console.log(`removing house with ID: ${houseIdToRemove}`);

    try {
        const { database } = await mongodb();

        const houses = await database.collection('houses')
        const allHouses = houses.find({ chain }).toArray();

        console.log('houses in db:', allHouses);

        return allHouses

        // Find and remove the house with the specified ID
        const result = await database.collection('houses').findOneAndDelete({ _id: "652f94414ed55530c7c9b8a6", chain });

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
