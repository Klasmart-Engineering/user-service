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
        postfix: string
    ): FileResult {
        const tmpFileObj = tmp.fileSync({ postfix: '.' + postfix })
        tmpFileObjs.push(tmpFileObj)
        return tmpFileObj
    }

    public testMimeType(mimeType: string): boolean {
        const mimetype = IMAGE_MIMETYPES.find(function (mime) {
            return mime === mimeType
        })
        if (mimetype) {
            return true
        }
        return false
    }

    public isHexColor(hex: string): boolean {
        return (
            typeof hex === 'string' &&
            hex.length === 6 &&
            !isNaN(Number('0x' + hex))
        )
    }

    public extensionFromMimeType(mimetype: string): string {
        let tail = ''
        const matchRes = mimetype.match(/[^/]+$/)
        if (matchRes) {
            tail = matchRes[0]
        }
        return tail
    }

    private async checkImageFile(filename: string) {
        //The following will throw an exception if the binary image file is in the wrong format
        const dimstr = (await identifyImage([
            '-format',
            '%wx%h',
            filename,
        ])) as string
        const dims = dimstr.split('x')
        const width = parseInt(dims[0])
        const height = parseInt(dims[1])
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
        tmpFileObjs: FileResult[],
        file: FileUpload,
        tail: string,
        brandingId: string
    ): Promise<brandingUrlMap> {
        const iconFileName = brandingId + '.icon.' + tail
        const faviconFileName = brandingId + '.favicon.ico'

        const initialIconStream = file.createReadStream()

        const tmpIconFileObj = this.makeAndStoreTempFile(
            tmpFileObjs,
            '.' + tail
        )
        const tmpFavFileObj = this.makeAndStoreTempFile(tmpFileObjs, '.ico')

        await streamToFile(initialIconStream, tmpIconFileObj.name)
        await this.checkImageFile(tmpIconFileObj.name)

        const iconStream = fs.createReadStream(tmpIconFileObj.name)
        const iconUrl = await upload('provider', iconStream, iconFileName)

        await this.scaleImageFile(
            tmpIconFileObj.name,
            tmpFavFileObj.name,
            '16x16'
        )

        const faviconStream = fs.createReadStream(tmpFavFileObj.name)
        const favUrl = await upload('provider', faviconStream, faviconFileName)
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
            if (primaryColor && !this.isHexColor(primaryColor)) {
                throw new Error(
                    'PrimaryColor: "' +
                        primaryColor +
                        '" is not a valid hexadecimal triplet'
                )
            }
            if (file) {
                if (!this.testMimeType(file.mimetype)) {
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
                const tail = this.extensionFromMimeType(file.mimetype)
                const imageRecord = new BrandingImage()
                imageRecord.tag = brandingImageTag.ICON
                imageRecord.branding = branding
                const favImageRecord = new BrandingImage()
                favImageRecord.tag = brandingImageTag.FAVICON
                favImageRecord.branding = branding

                const urls = await this.checkScaleStoreBrandingImages(
                    tmpFileObjs,
                    file,
                    tail,
                    branding.id
                )
                imageRecord.url = iconUrl = urls.icon
                favImageRecord.url = faviconUrl = urls.favicon

                //const iconFileName = branding.id + '.icon.' + tail
                //const faviconFileName = branding.id + '.favicon.ico'

                // This is not the real way of getting the url
                //iconUrl = 'http://localhost:8080/' + iconFileName
                //imageRecord.url = iconUrl

                // This is not the real way of getting the url
                //faviconUrl = 'http://localhost:8080/' + faviconFileName
                //favImageRecord.url = faviconUrl

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

function identifyImage(args: string[]) {
    return new Promise((resolve, reject) => {
        im.identify(args, function (err, stdout) {
            if (err) {
                reject(err)
            }
            resolve(stdout)
        })
    })
}

async function upload(provider: string, stream: ReadStream, fileName: string) {
    await streamToFile(stream, '/work/tmp/' + fileName)
    return 'http://localhost:8080/' + fileName
}

const streamToFile = (inputStream: ReadStream, filePath: string) => {
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
