import { FileUpload } from 'graphql-upload'
import { Connection } from 'typeorm'
import { Branding, brandingUUID } from '../entities/branding'
import { BrandingImage } from '../entities/brandingImage'
import { Organization } from '../entities/organization'
import { brandingImageTag } from '../types/graphQL/brandingImageTag'
import { brandingResult } from '../types/graphQL/brandingresult'
import { IMAGE_MIMETYPES } from '../utils/imageStore/imageMimeTypes'
import { ReadStream } from 'typeorm/platform/PlatformTools'
import im from 'imagemagick'
import tmp, { FileResult } from 'tmp'
import * as fs from 'fs'

interface brandingUrlMap {
    icon: string
    favicon: string
}

export class ImageStorer {
    private makeAndStoreTempFile(
        tmpFileObjs: FileResult[],
        extension: string
    ): FileResult {
        const tmpFileObj = tmp.fileSync({ postfix: '.' + extension })
        tmpFileObjs.push(tmpFileObj)
        return tmpFileObj
    }

    public static testMimeType(mimeType: string): boolean {
        const mimetype = IMAGE_MIMETYPES.find(function (mime) {
            return mime === mimeType
        })
        if (mimetype) {
            return true
        }
        return false
    }

    public static isHexColor(hex: string): boolean {
        return (
            typeof hex === 'string' &&
            hex.length === 6 &&
            !isNaN(Number('0x' + hex))
        )
    }

    public static extensionFromMimeType(mimetype: string): string {
        let extension = ''
        const matchRes = mimetype.match(/[^/]+$/)
        if (matchRes) {
            extension = matchRes[0]
        }
        return extension
    }

    private async checkImageFile(filename: string) {
        //The following will throw an exception if the binary image file is in the wrong format
        const dimstr = await identifyImage(['-format', '%wx%h', filename])
        const [width, height] = dimstr.split('x').map((e) => parseInt(e))
        if (width > 1000) {
            throw new Error('Image is too large over 1000 pixels wide')
        }
        if (height > 1000) {
            throw new Error('Image is too large over 1000 pixels high')
        }
    }

    private async scaleImageFile(
        sourceFileName: string,
        destFileName: string,
        destinationSize: string
    ) {
        await convertImage([
            sourceFileName,
            '-resize',
            destinationSize,
            destFileName,
        ])
    }

    private async checkScaleStoreBrandingImages(
        organizationId: string,
        tmpFileObjs: FileResult[],
        file: FileUpload,
        extension: string,
        brandingId: string
    ): Promise<brandingUrlMap> {
        const iconFileName = 'icon.' + extension
        const faviconFileName = 'favicon.ico'

        const provider = process.env.PROVIDER || 'amazon'
        const initialIconStream = file.createReadStream()

        const tmpIconFileObj = this.makeAndStoreTempFile(
            tmpFileObjs,
            '.' + extension
        )
        const tmpFavFileObj = this.makeAndStoreTempFile(tmpFileObjs, '.ico')

        await streamToFile(initialIconStream, tmpIconFileObj.name)
        await this.checkImageFile(tmpIconFileObj.name)

        const iconStream = fs.createReadStream(tmpIconFileObj.name)
        const iconUrl = await upload(
            provider,
            organizationId,
            iconStream,
            iconFileName,
            brandingId,
            brandingImageTag.ICON
        )

        await this.scaleImageFile(
            tmpIconFileObj.name,
            tmpFavFileObj.name,
            '16x16'
        )

        const faviconStream = fs.createReadStream(tmpFavFileObj.name)
        const favUrl = await upload(
            provider,
            organizationId,
            faviconStream,
            faviconFileName,
            brandingId,
            brandingImageTag.FAVICON
        )

        return { icon: iconUrl, favicon: favUrl }
    }

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
        const tmpFileObjs: FileResult[] = []
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
                if (!testMimeType(file.mimetype)) {
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
                const extension = extensionFromMimeType(file.mimetype)
                const imageRecord = new BrandingImage()
                imageRecord.tag = brandingImageTag.ICON
                imageRecord.branding = branding
                const favImageRecord = new BrandingImage()
                favImageRecord.tag = brandingImageTag.FAVICON
                favImageRecord.branding = branding

                const urls = await this.checkScaleStoreBrandingImages(
                    organizationId,
                    tmpFileObjs,
                    file,
                    extension,
                    branding.id
                )
                imageRecord.url = iconUrl = urls.icon
                favImageRecord.url = faviconUrl = urls.favicon

                await queryRunner.manager.save(imageRecord)
                await queryRunner.manager.save(favImageRecord)
                imageRecords.push(imageRecord)
                imageRecords.push(favImageRecord)
            }
            branding.images = imageRecords
            await queryRunner.manager.save(branding)

            result = {
                iconImageURL: iconUrl,
                faviconImageURL: faviconUrl,
                primaryColor: primaryColor,
            }
            queryRunner.commitTransaction()
        } catch (err) {
            console.log(err)
            dberr = err
            await queryRunner.rollbackTransaction()
        } finally {
            await queryRunner.release()
            unlinkFileObjs(tmpFileObjs)
        }

        if (dberr) {
            throw dberr
        }
        return result
    }
}

function convertImage(args: string[]) {
    return new Promise((resolve, reject) => {
        im.convert(args, function (err, stdout) {
            if (err) {
                reject(err)
            }
            resolve(stdout)
        })
    })
}

export function identifyImage(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        im.identify(args, function (err, stdout) {
            if (err) {
                reject(err)
            }
            resolve(stdout)
        })
    })
}

async function upload(
    provider: string,
    organizationId: string,
    stream: ReadStream,
    fileName: string,
    prefix: string,
    imageType: string
) {
    //await streamToFile(stream, '/work/tmp/' + fileName)
    return 'http://localhost:8080/' + fileName
}

export const streamToFile = (inputStream: ReadStream, filePath: string) => {
    return new Promise((resolve, reject) => {
        const fileWriteStream = fs.createWriteStream(filePath)
        inputStream
            .pipe(fileWriteStream)
            .on('finish', resolve)
            .on('error', reject)
    })
}

function unlinkFileObjs(fileObjs: FileResult[]) {
    for (const fileObj of fileObjs) {
        if (fileObj) {
            fs.unlink(fileObj.name, (err) => {
                if (err) {
                    console.log(err)
                }
            })
        }
    }
}

export const isHexColor = ImageStorer.isHexColor
export const testMimeType = ImageStorer.testMimeType
export const extensionFromMimeType = ImageStorer.extensionFromMimeType
