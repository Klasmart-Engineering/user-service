import { FileUpload } from 'graphql-upload'
import { Connection } from 'typeorm'
import { Branding } from '../entities/branding'
import { BrandingError } from '../types/errors/branding/brandingError'
import BrandingErrorConstants from '../types/errors/branding/brandingErrorConstants'
import { BrandingImage } from '../entities/brandingImage'
import { BrandingImageInfo } from '../types/graphQL/branding'
import { CustomError } from '../types/errors/customError'
import { isHexadecimalColor } from '../utils/stringUtils'
import { IMAGE_MIMETYPES, ImageMimeType } from '../types/imageMimeTypes'

export class BrandingStorer {
    public static async call(
        organizationId: string,
        file: FileUpload,
        brandingImagesInfo: BrandingImageInfo[],
        primaryColor: string,
        connection: Connection
    ): Promise<void> {
        this.validatePrimaryColor(primaryColor)
        this.validateFile(file)

        await connection.manager.transaction(async (manager) => {
            const upsertResult = await manager
                .createQueryBuilder()
                .insert()
                .into(Branding)
                .values({
                    primaryColor: primaryColor,
                    organization: <any>organizationId,
                })
                .orUpdate({
                    conflict_target: ['organization_id'],
                    overwrite: ['primary_color'],
                })
                .execute()

            const brandingInfo = upsertResult.generatedMaps[0]

            for (const brandingImageinfo of brandingImagesInfo) {
                const image = await this.generateBradingImage(
                    brandingInfo,
                    brandingImageinfo
                )
                await manager.save(image)
            }
        })
    }

    private static validatePrimaryColor(primaryColor: string): void {
        if (primaryColor && !isHexadecimalColor(primaryColor)) {
            const errorDetails: CustomError = {
                code: BrandingErrorConstants.ERR_INVALID_HEXADECIMAL_COLOR,
                message: BrandingErrorConstants.MSG_INVALID_HEXADECIMAL_COLOR,
                params: { color: primaryColor },
            }

            throw new BrandingError(errorDetails)
        }
    }

    private static validateFile(file: FileUpload): void {
        if (file && !IMAGE_MIMETYPES.includes(file.mimetype as ImageMimeType)) {
            const errorDetails: CustomError = {
                code: BrandingErrorConstants.ERR_UNSUPPORTED_MIMETYPE,
                message: BrandingErrorConstants.MSG_UNSUPPORTED_MIMETYPE,
                params: { mimetype: file.mimetype },
            }

            throw new BrandingError(errorDetails)
        }
    }

    private static async generateBradingImage(
        brandingInfo: Record<string, unknown>,
        brandingImageInfo: BrandingImageInfo
    ): Promise<BrandingImage> {
        const brandingImage: BrandingImage = new BrandingImage()

        brandingImage.url = brandingImageInfo.imageUrl
        brandingImage.tag = brandingImageInfo.tag
        brandingImage.branding = <any>brandingInfo.id

        return Promise.resolve(brandingImage)
    }
}
