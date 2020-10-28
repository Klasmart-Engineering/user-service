import { ReadStream } from "fs"

export namespace ApolloServerFileUploads {

  export type File = {
    filename: string;
    mimetype: string;
    encoding: string;
    createReadStream(): ReadStream;
  }
  
  export type UploadedFileResponse = {
    filename: string;
    mimetype: string;
    encoding: string;
    url: string;
    key: string;
  }

}

export type ErrorObj = {
  field: string;
  message: string;
}
