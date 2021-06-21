import { BrandingImageTag } from './brandingImageTag'

export interface BrandingResult {
    iconImageURL?: string
    faviconImageURL?: string
    primaryColor?: string
}

export interface BrandingImageInfo {
    imageUrl: string
    tag: BrandingImageTag
}
