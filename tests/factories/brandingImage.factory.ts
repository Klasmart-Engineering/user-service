import faker from 'faker'
import { BrandingImage } from '../../src/entities/brandingImage'
import { BrandingImageTag } from '../../src/types/graphQL/branding'

export function createBrandingImage() {
    const brandingImage = new BrandingImage()
    brandingImage.tag = BrandingImageTag.ICON
    brandingImage.url = faker.internet.url()
    return brandingImage
}
