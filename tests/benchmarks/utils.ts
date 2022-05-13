/* eslint-disable no-console */
export async function reportAverageAndErrorBars(
    iterations: number,
    operation: () => Promise<any>
) {
    const timings = []
    for (let i = 0; i < iterations; i++) {
        console.time('query')

        const start = Date.now()
        // eslint-disable-next-line no-await-in-loop
        await operation()
        const end = Date.now()

        timings.push(end - start)
        console.timeEnd('query')
    }

    const average = timings.reduce((t1, t2) => t1 + t2, 0) / timings.length
    const standardDev = Math.sqrt(
        timings
            .map((t) => Math.pow(t - average, 2))
            .reduce((t1, t2) => t1 + t2) / timings.length
    )

    console.log(
        `PERFORMANCE: ${Math.floor(average)}ms +/- ${Math.floor(standardDev)}ms`
    )
}
