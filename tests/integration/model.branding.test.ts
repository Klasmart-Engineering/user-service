import chaiAsPromised from 'chai-as-promised'
import fs from 'fs'
import { stub, restore } from 'sinon'

import { resolve } from 'path'
import { ReadStream } from 'fs'
import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { createTestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Model } from '../../src/model'
import {
    setBranding,
    setBrandingWithoutImage,
    setBrandingWithoutPrimaryColor,
} from '../utils/operations/brandingOps'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createAdminUser } from '../utils/testEntities'
import { CloudStorageUploader } from '../../src/services/cloudStorageUploader'
import { Branding } from '../../src/entities/branding'
import { BrandingImage } from '../../src/entities/brandingImage'
import { ImageMimeType } from '../../src/types/imageMimeTypes'
import { Status } from '../../src/entities/status'

use(chaiAsPromised)

describe('model.branding', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    const filename = 'icon.png'
    const remoteUrl = 'http://some.url'

    const filenameToUpdate = 'icon.jpg'

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
        stub(CloudStorageUploader, 'call').returns(Promise.resolve(remoteUrl))
    })

    after(async () => {
        restore()
        await connection?.close()
    })

    let organizationId: string

    beforeEach(async () => {
        const user = await createAdminUser(testClient)
        const organization = await createOrganizationAndValidate(
            testClient,
            user.user_id,
            'Some fabulous organization'
        )
        organizationId = organization.organization_id
    })

    describe('setBranding', () => {
        const mimetype = 'image/png'
        const encoding = '7bit'
        context(
            'when the parameters and input file are correctly specified.',
            () => {
                it('should succeed in setting the branding', async () => {
                    const primaryColor = '#cd657b'
                    const iconImage = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )
                    const branding = await setBranding(
                        testClient,
                        organizationId,
                        iconImage,
                        filename,
                        mimetype,
                        encoding,
                        primaryColor
                    )
                    expect(branding).to.exist
                    expect(branding.primaryColor).to.equal(primaryColor)
                    const brandings = await Branding.find()
                    expect(brandings.length).to.equal(1)
                    const images = await BrandingImage.find()
                    expect(images.length).to.equal(1)
                })
            }
        )

        context('when the file is the wrong mime type', () => {
            it('should fail in setting the branding and not create new db records', async () => {
                const primaryColor = '#cd657b'
                const iconImage = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                try {
                    const branding = await setBranding(
                        testClient,
                        organizationId,
                        iconImage,
                        filename,
                        'application/pdf' as ImageMimeType,
                        encoding,
                        primaryColor
                    )
                } catch (e) {
                    expect(e).to.exist
                }
                const brandings = await Branding.find()
                expect(brandings.length).to.equal(0)
                const images = await BrandingImage.find()
                expect(images.length).to.equal(0)
            })
        })

        context('when the primary colour is not a hex triplet', () => {
            it('should fail in setting the branding and not create new db records', async () => {
                const wrongfile = 'rolesExample.csv'
                const primaryColor = 'YYYYYY'
                const iconImage = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                try {
                    const branding = await setBranding(
                        testClient,
                        organizationId,
                        iconImage,
                        filename,
                        mimetype,
                        encoding,
                        primaryColor
                    )
                } catch (e) {
                    expect(e).to.exist
                }
                const brandings = await Branding.find()
                expect(brandings.length).to.equal(0)
                const images = await BrandingImage.find()
                expect(images.length).to.equal(0)
            })
        })

        context('when branding is created for first time', () => {
            context('and iconImage is not provided', () => {
                it('should throw an error', async () => {
                    const primaryColor = '#cd657b'
                    const func = () =>
                        setBrandingWithoutImage(
                            testClient,
                            organizationId,
                            primaryColor
                        )

                    const organizationBranding = await Branding.findOne({
                        where: {
                            organization: { organization_id: organizationId },
                        },
                    })

                    expect(func()).to.be.rejected
                    expect(organizationBranding).to.be.undefined
                })
            })
        })

        context('when branding is already created', () => {
            context('and primaryColor and iconImage are provided', () => {
                it('should update primaryColor and iconImage', async () => {
                    const primaryColor = '#cd657b'
                    const iconImage = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )
                    await setBranding(
                        testClient,
                        organizationId,
                        iconImage,
                        filename,
                        mimetype,
                        encoding,
                        primaryColor
                    )

                    const newColor = '#b22222'
                    const newImage = fs.createReadStream(
                        resolve(`tests/fixtures/${filenameToUpdate}`)
                    )
                    const branding = await setBranding(
                        testClient,
                        organizationId,
                        newImage,
                        filenameToUpdate,
                        mimetype,
                        encoding,
                        newColor
                    )

                    expect(branding.primaryColor).to.equal(newColor)

                    const brandings = await Branding.find({
                        where: {
                            organization: { organization_id: organizationId },
                        },
                    })
                    expect(brandings.length).to.equal(1)

                    const images = await BrandingImage.find({
                        where: {
                            branding: brandings[0],
                            status: Status.ACTIVE,
                        },
                    })
                    expect(images.length).to.equal(1)
                })
            })

            context(
                'and primaryColor is not provided and iconImage is provided',
                () => {
                    it('should set primaryColor as null and update iconImage', async () => {
                        const primaryColor = '#cd657b'
                        const iconImage = fs.createReadStream(
                            resolve(`tests/fixtures/${filename}`)
                        )
                        await setBranding(
                            testClient,
                            organizationId,
                            iconImage,
                            filename,
                            mimetype,
                            encoding,
                            primaryColor
                        )

                        const newImage = fs.createReadStream(
                            resolve(`tests/fixtures/${filenameToUpdate}`)
                        )
                        const branding = await setBrandingWithoutPrimaryColor(
                            testClient,
                            organizationId,
                            newImage,
                            filenameToUpdate,
                            mimetype,
                            encoding
                        )
                        expect(branding.iconImageURL).to.exist

                        expect(branding.primaryColor).to.be.null

                        const brandings = await Branding.find({
                            where: {
                                organization: {
                                    organization_id: organizationId,
                                },
                            },
                        })
                        expect(brandings.length).to.equal(1)

                        const images = await BrandingImage.find({
                            where: {
                                branding: brandings[0],
                                status: Status.ACTIVE,
                            },
                        })
                        expect(images.length).to.equal(1)
                    })
                }
            )

            context(
                'and primaryColor is provided and iconImage is not provided',
                () => {
                    it('should update primaryColor', async () => {
                        const primaryColor = '#cd657b'
                        const iconImage = fs.createReadStream(
                            resolve(`tests/fixtures/${filename}`)
                        )
                        await setBranding(
                            testClient,
                            organizationId,
                            iconImage,
                            filename,
                            mimetype,
                            encoding,
                            primaryColor
                        )

                        const newColor = '#b22222'
                        const branding = await setBrandingWithoutImage(
                            testClient,
                            organizationId,
                            newColor
                        )

                        expect(branding.primaryColor).to.equal(newColor)

                        const brandings = await Branding.find({
                            where: {
                                organization: {
                                    organization_id: organizationId,
                                },
                            },
                        })
                        expect(brandings.length).to.equal(1)

                        const images = await BrandingImage.find({
                            where: {
                                branding: brandings[0],
                                status: Status.ACTIVE,
                            },
                        })
                        expect(images.length).to.equal(1)
                    })
                }
            )
        })
    })
})
