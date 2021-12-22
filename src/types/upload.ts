import { Readable } from 'stream'
export interface Upload {
    filename: string
    mimetype: string
    encoding: string
    // graphql-upload actually expects this to be fs.ReadSteam
    // but we restrict it to just Readable to make it easier
    // to mock file uploads in tests
    createReadStream: () => Readable
}
