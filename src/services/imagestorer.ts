import { FileUpload } from 'graphql-upload'
import { Connection } from 'typeorm'
import { Branding, brandingUUID } from '../entities/branding'
import { BrandingImage } from '../entities/brandingImage'
import { Organization } from '../entities/organization'
import { brandingImageTag } from '../types/graphQL/brandingImageTag'
import { brandingResult } from '../types/graphQL/brandingresult'
import { IMAGE_MIMETYPES } from '../utils/imageStore/imageMimeTypes'
import { isHexColor } from '../utils/validations'

export class ImageStorer {
    public async storeBranding(
        organizationId: string,
        file: FileUpload,
        primaryColor: string,
        connection: Connection
    ): Promise<brandingResult | undefined> {
        let result: brandingResult | undefined
        let dberr: Error | undefined

        const queryRunner = connection.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()
        let success = true
        try {
            /* Validations */
            if (primaryColor && !isHexColor(primaryColor)) {
                throw new Error(
                    'PrimaryColor: "' +
                        primaryColor +
                        '" is not a valid hexadecimal triplet'
                )
            }
            if (file) {
                const mimeType = IMAGE_MIMETYPES.find(function (mime) {
                    return mime === file.mimetype
                })
                if (!mimeType) {
                    throw new Error(
                        'IconImage mimetype "' +
                            file.mimetype +
                            '" not supported'
                    )
                }
            }

            /* database finding */
            const organization = await queryRunner.manager.findOneOrFail(
                Organization,
                {
                    organization_id: organizationId,
                }
            )

            /* database setting */

            const branding = new Branding()
            branding.id = brandingUUID(organizationId)
            branding.organization = Promise.resolve(organization)
            if (primaryColor) {
                branding.primaryColor = primaryColor
            }
            await queryRunner.manager.save(branding)

            let iconUrl: string | undefined
            let faviconUrl: string | undefined

            const imageRecords = branding
                ? (await queryRunner.manager.find(BrandingImage, {
                      branding,
                  })) || []
                : []

            if (file) {
                let tail = ''
                const matchRes = file.mimetype.match(/[^/]+$/)
                if (matchRes) {
                    tail = matchRes[0]
                }
                const imageRecord = new BrandingImage()
                imageRecord.tag = brandingImageTag.ICON
                imageRecord.branding = branding
                const favImageRecord = new BrandingImage()
                favImageRecord.tag = brandingImageTag.FAVICON
                favImageRecord.branding = branding

                const iconFileName = branding.id + '.icon.' + tail
                const faviconFileName = branding.id + '.favicon.ico'

                // This is not the real way of getting the url
                iconUrl = 'http://localhost:8080/' + iconFileName
                imageRecord.url = iconUrl

                // This is not the real way of getting the url
                faviconUrl = 'http://localhost:8080/' + faviconFileName
                favImageRecord.url = faviconUrl

                await queryRunner.manager.save(imageRecord)
                await queryRunner.manager.save(favImageRecord)
                imageRecords.push(imageRecord)
                imageRecords.push(favImageRecord)
            }
            branding.images = imageRecords
            await queryRunner.manager.save(branding)

            result = {
                organizationId: organizationId,
                iconImageURL: iconUrl ? iconUrl : '',
                faviconImageURL: faviconUrl ? faviconUrl : '',
                primaryColor: primaryColor,
            }
            queryRunner.commitTransaction()
        } catch (err) {
            success = false
            console.log(err)
            dberr = err
            await queryRunner.rollbackTransaction()
        } finally {
            await queryRunner.release()
        }

        if (!success && dberr) {
            throw dberr
        }
        return result
    }
}
