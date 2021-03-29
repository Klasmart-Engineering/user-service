export function formatCSVRow(row: any) {
    const keys = Object.keys(row)
    const formattedValues = Object.values(row).map((value) => {
        return value || null
    })

    keys.forEach((key, index) => {
        Object.assign(row, { [key]: formattedValues[index] })
    })

    return row
}
