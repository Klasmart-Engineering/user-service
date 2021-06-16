import { FileUpload } from 'graphql-upload'

export interface Uploader {
    file: FileUpload
}

export interface setBrandingInput {
    organizationId: string
    primaryColor: string
    iconImage: Promise<Uploader>
}
