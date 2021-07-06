import { BrandingImageTag } from './brandingImageTag'

export interface BrandingResult {
    iconImageURL?: string
    primaryColor?: string | null
}

export interface BrandingImageInfo {
    imageUrl: string
    tag: BrandingImageTag
}
