// The last value calculated during the execution of this task. 
let lastExecutionResult: number = 0; 

export default async (pricePerIncrement: number, medianFee: number ) => {
    try {
        // Update the result of the last execution. 
        let realNumber = pricePerIncrement * medianFee * 451059 * 0.0001;
        lastExecutionResult = Number((realNumber).toFixed(realNumber >= 0.01 ? 5 : 6));
    } catch (error) {
        console.error(error); 
    } finally {
        return lastExecutionResult; 
    }
}; 