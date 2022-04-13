import { FileUpload } from 'graphql-upload'

export interface BrandingResult {
    iconImageURL?: string
    primaryColor?: string | null
}

export interface BrandingImageInfo {
    imageUrl: string
    tag: BrandingImageTag
}

export enum BrandingImageTag {
    ICON = 'ICON',
}
export interface deleteBrandingImageInput {
    organizationId: string
    type: BrandingImageTag
}

export interface DeleteBrandingColorInput {
    organizationId: string
}

export interface BrandingInput {
    primaryColor: string | undefined
    iconImage: Promise<Uploader>
}

export interface Uploader {
    file: FileUpload
}

export interface setBrandingInput extends BrandingInput {
    organizationId: string
}
