export const convertDataToCursor = (data: string) => {
    return Buffer.from(data).toString('base64')
}