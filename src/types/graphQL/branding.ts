import { BrandingImageTag } from './brandingImageTag'

export interface BrandingResult {
    iconImageURL?: string
    primaryColor?: string
}

export interface BrandingImageInfo {
    imageUrl: string
    tag: BrandingImageTag
}
