// The last value calculated during the execution of this task. 
let lastExecutionResult: number = 0; 

export default async (pricePerIncrement: number, medianFee: number ) => {
    try {
        // Update the result of the last execution. 
        lastExecutionResult = Number((pricePerIncrement * medianFee * 21000).toFixed(2));
    } catch (error) {
        console.error(error); 
    } finally {
        return lastExecutionResult; 
    }
}; 