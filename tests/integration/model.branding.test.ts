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
    deleteBrandingImageMutation,
    deleteBrandingImageQuery,
    setBranding,
    setBrandingWithoutImage,
    setBrandingWithoutPrimaryColor,
    deleteBrandingColorMutation,
} from '../utils/operations/brandingOps'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { CloudStorageUploader } from '../../src/services/cloudStorageUploader'
import { Branding } from '../../src/entities/branding'
import { BrandingImage } from '../../src/entities/brandingImage'
import { ImageMimeType } from '../../src/types/imageMimeTypes'
import { Status } from '../../src/entities/status'
import { BrandingImageTag } from '../../src/types/graphQL/brandingImageTag'
import { Organization } from '../../src/entities/organization'
import { getNonAdminAuthToken } from '../utils/testConfig'

use(chaiAsPromised)

describe('model.branding', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    const mimetype = 'image/png'
    const encoding = '7bit'
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

    let organization: Organization
    let organizationId: string
    let arbitraryUserToken: string

    beforeEach(async () => {
        const user = await createAdminUser(testClient)
        organization = await createOrganizationAndValidate(
            testClient,
            user.user_id,
            'Some fabulous organization'
        )
        organizationId = organization.organization_id
        await createNonAdminUser(testClient)
        arbitraryUserToken = getNonAdminAuthToken()
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
                        primaryColor,
                        { authorization: arbitraryUserToken }
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
                        primaryColor,
                        { authorization: arbitraryUserToken }
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
                        primaryColor,
                        { authorization: arbitraryUserToken }
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
                            primaryColor,
                            { authorization: arbitraryUserToken }
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
                        primaryColor,
                        { authorization: arbitraryUserToken }
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
                        newColor,
                        { authorization: arbitraryUserToken }
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
                            primaryColor,
                            { authorization: arbitraryUserToken }
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
                            encoding,
                            { authorization: arbitraryUserToken }
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
                            primaryColor,
                            { authorization: arbitraryUserToken }
                        )

                        const newColor = '#b22222'
                        const branding = await setBrandingWithoutImage(
                            testClient,
                            organizationId,
                            newColor,
                            { authorization: arbitraryUserToken }
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

    describe('deleteBrandingImage', () => {
        context('when operation is not a mutation', () => {
            beforeEach(async () => {
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
                    primaryColor,
                    { authorization: arbitraryUserToken }
                )
            })

            it('should throw an error', async () => {
                const type = BrandingImageTag.ICON
                const func = () =>
                    deleteBrandingImageQuery(
                        testClient,
                        organizationId,
                        type,
                        arbitraryUserToken
                    )

                const branding = await Branding.findOne({
                    where: {
                        organization: { organization_id: organizationId },
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding, tag: type },
                })

                expect(func()).to.be.rejected
                expect(branding).to.exist
                expect(brandingImage).to.exist
                expect(brandingImage?.status).eq(Status.ACTIVE)
            })
        })

        context('when type is not a valid type', () => {
            beforeEach(async () => {
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
                    primaryColor,
                    { authorization: arbitraryUserToken }
                )
            })

            it('should throw an error', async () => {
                const type = BrandingImageTag.ICON
                const wrongType = 'NOTICON'
                const func = () =>
                    deleteBrandingImageQuery(
                        testClient,
                        organizationId,
                        wrongType,
                        arbitraryUserToken
                    )

                const branding = await Branding.findOne({
                    where: {
                        organization: { organization_id: organizationId },
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding, tag: type },
                })

                expect(func()).to.be.rejected
                expect(branding).to.exist
                expect(brandingImage).to.exist
                expect(brandingImage?.status).eq(Status.ACTIVE)
            })
        })

        context('when organization is not a valid ID', () => {
            beforeEach(async () => {
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
                    primaryColor,
                    { authorization: arbitraryUserToken }
                )
            })

            it('should throw an error', async () => {
                const type = BrandingImageTag.ICON
                const wrongId = 'n0t-4n-1d'
                const func = () =>
                    deleteBrandingImageQuery(
                        testClient,
                        wrongId,
                        type,
                        arbitraryUserToken
                    )

                const branding = await Branding.findOne({
                    where: {
                        organization: { organization_id: organizationId },
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding, tag: type },
                })

                expect(func()).to.be.rejected
                expect(branding).to.exist
                expect(brandingImage).to.exist
                expect(brandingImage?.status).eq(Status.ACTIVE)
            })
        })

        context(
            'when organizationId does not belongs to any organization',
            () => {
                beforeEach(async () => {
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
                        primaryColor,
                        { authorization: arbitraryUserToken }
                    )
                })

                it('should throw an error', async () => {
                    const type = BrandingImageTag.ICON
                    const noneExistingId =
                        '00000000-0000-0000-0000-000000000000'
                    const func = () =>
                        deleteBrandingImageQuery(
                            testClient,
                            noneExistingId,
                            type,
                            arbitraryUserToken
                        )

                    const branding = await Branding.findOne({
                        where: {
                            organization: { organization_id: organizationId },
                            status: Status.ACTIVE,
                        },
                    })

                    const brandingImage = await BrandingImage.findOne({
                        where: { branding, tag: type },
                    })

                    expect(func()).to.be.rejected
                    expect(branding).to.exist
                    expect(brandingImage).to.exist
                    expect(brandingImage?.status).eq(Status.ACTIVE)
                })
            }
        )

        context('when organization has not branding', () => {
            it('should throw an error', async () => {
                const type = BrandingImageTag.ICON
                const func = () =>
                    deleteBrandingImageMutation(
                        testClient,
                        organizationId,
                        type,
                        arbitraryUserToken
                    )

                const branding = await Branding.findOne({
                    where: {
                        organization: { organization_id: organizationId },
                        status: Status.ACTIVE,
                    },
                })

                expect(func()).to.be.rejected
                expect(branding).to.not.exist
            })
        })

        context('when organization branding has not branding image', () => {
            beforeEach(async () => {
                const branding = new Branding()
                branding.organization = Promise.resolve(organization)
                branding.primaryColor = '#008080'
                await Branding.save(branding)
            })

            it('should throw an error', async () => {
                const type = BrandingImageTag.ICON
                const func = () =>
                    deleteBrandingImageMutation(
                        testClient,
                        organizationId,
                        type,
                        arbitraryUserToken
                    )

                const branding = await Branding.findOne({
                    where: {
                        organization: { organization_id: organizationId },
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding, tag: type },
                })

                expect(func()).to.be.rejected
                expect(branding).to.exist
                expect(brandingImage).to.not.exist
            })
        })

        context('when organization branding has branding image', () => {
            beforeEach(async () => {
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
                    primaryColor,
                    { authorization: arbitraryUserToken }
                )
            })

            it('should set image status as "inactive"', async () => {
                const type = BrandingImageTag.ICON
                const result = await deleteBrandingImageMutation(
                    testClient,
                    organizationId,
                    type,
                    arbitraryUserToken
                )

                const branding = await Branding.findOne({
                    where: {
                        organization: { organization_id: organizationId },
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding, tag: type },
                })

                expect(result).eq(true)
                expect(branding).to.exist
                expect(brandingImage).to.exist
                expect(brandingImage?.status).eq(Status.INACTIVE)
            })
        })
    })

    describe('deleteBrandingColor', () => {
        let branding: Branding | undefined
        const primaryColor = '#cd657b'

        it('removes any set colour while leaving other properties unchanged', async () => {
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
                primaryColor,
                { authorization: arbitraryUserToken }
            )
            branding = await Branding.findOne({
                relations: ['images'],
                where: {
                    organization: { organization_id: organizationId },
                },
            })
            expect(branding).to.exist
            expect(branding?.primaryColor).to.eq(primaryColor)
            expect(branding?.images?.length).to.eq(1)

            await deleteBrandingColorMutation(
                testClient,
                organizationId,
                arbitraryUserToken
            )

            branding = await Branding.findOne({
                relations: ['images'],
                where: {
                    organization: { organization_id: organizationId },
                },
            })

            expect(branding).to.exist
            expect(branding?.primaryColor).to.eq(null)
            expect(branding?.images?.length).to.eq(1)
        })
        context('when organization has not branding', () => {
            it('should throw an error', async () => {
                const func = () =>
                    deleteBrandingColorMutation(
                        testClient,
                        organizationId,
                        arbitraryUserToken
                    )

                expect(func()).to.be.rejected
            })
        })
    })
})
