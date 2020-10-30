import AWS from "aws-sdk"
import stream from "stream"
import { ApolloServerFileUploads } from "./types"
import { ApolloError } from 'apollo-server-express'
import { generate } from 'shortid';

type S3Config = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  destinationBucketName: string;
  signedUrlExpireSeconds?: number;
};

type S3UploadStream = {
  writeStream: stream.PassThrough;
  promise: Promise<AWS.S3.ManagedUpload.SendData>;
};

export class AWSS3 {
  private s3: AWS.S3;
  private static instance: AWSS3;
  public config: S3Config;

  private constructor(config: S3Config) {
    AWS.config = new AWS.Config();
    AWS.config.update({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      signatureVersion: 'v4',
    });

    this.s3 = new AWS.S3();
    this.config = config;
    this.config.signedUrlExpireSeconds = config.signedUrlExpireSeconds || 300 // 5 minutes 
  }

  static getInstance(config: S3Config): AWSS3 {
    if(!AWSS3.instance) {
      AWSS3.instance = new AWSS3(config)
    }

    return AWSS3.instance
  }

  async deleteObject(key: string) { 
    let params = {Key: key, Bucket: this.config.destinationBucketName}
    await this.s3.deleteObject(params).promise();
  }

  getSignedUrl(key: string): string {
    const url = this.s3.getSignedUrl('getObject', {
      Bucket: this.config.destinationBucketName,
      Key: key,
      Expires: this.config.signedUrlExpireSeconds
    });
    return url
  }

  private createUploadStream(key: string): S3UploadStream {
    const pass = new stream.PassThrough();
    return {
      writeStream: pass,
      promise: this.s3
        .upload({
          Bucket: this.config.destinationBucketName,
          Key: key,
          Body: pass
        })
        .promise()
    };
  }

  private createDestinationFilePath(
    fileName: string,
    mimetype: string,
    encoding: string,
    path?: string
  ): string {
    
    const cleanedName = fileName.replace(/[^a-zA-Z0-9.()]/g, "")
    if(!path || (path && path.length === 0)) {
      return `${generate()}_${cleanedName}`
    }
    return `${path}/${generate()}_${cleanedName}`
  }
  
  private validateType(type: string, mime: string): boolean {
    switch (type){ 
      case 'image':
        return /jpg|jpeg|png|bmp|gif|webp/i.test(mime.toLowerCase())
    }
    return false
  }

  async singleFileUpload({file, type, path}: {file: ApolloServerFileUploads.File, type?: string, path?: string} ): Promise<ApolloServerFileUploads.UploadedFileResponse> {
    const { createReadStream, filename, mimetype, encoding } = await file;
    if(!filename || filename.length === 0) {
      throw new ApolloError(`File missing.`)
    }
    if(type && !this.validateType(type as string, mimetype)) { 
      throw new ApolloError(`File is not of valid ${type} type.`)
    }

    const filePath = this.createDestinationFilePath(
      filename,
      mimetype,
      encoding,
      path,
    );

    try {
      const uploadStream = this.createUploadStream(filePath);
  
      createReadStream().pipe(uploadStream.writeStream)
      const result = await uploadStream.promise
  
      return { filename, mimetype, encoding, url: result.Location, key: filePath };
    } catch(e) {
      throw new ApolloError(e)
    }
  }
}
