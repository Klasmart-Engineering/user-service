import chaiAsPromised from 'chai-as-promised'
import fs from 'fs'
import { stub, restore } from 'sinon'
import { resolve } from 'path'
import { expect, use } from 'chai'
import { Equal, getConnection } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { TestConnection } from '../utils/testConnection'
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
import { BrandingImageTag } from '../../src/types/graphQL/branding'
import { Organization } from '../../src/entities/organization'
import { getNonAdminAuthToken } from '../utils/testConfig'
import { NIL_UUID } from '../utils/database'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { Role } from '../../src/entities/role'

use(chaiAsPromised)

describe('model.branding', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    const mimetype = 'image/png'
    const encoding = '7bit'
    const filename = 'icon.png'
    const remoteUrl = 'http://some.url'

    const filenameToUpdate = 'icon.jpg'

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
        stub(CloudStorageUploader, 'call').returns(Promise.resolve(remoteUrl))
    })

    after(async () => {
        restore()
    })

    let organization: Organization
    let organizationId: string
    let arbitraryUserToken: string
    let role: Role

    beforeEach(async () => {
        const user = await createAdminUser(testClient)
        organization = await createOrganizationAndValidate(
            testClient,
            user.user_id,
            'Some fabulous organization'
        )

        organizationId = organization.organization_id
        const nonAdmin = await createNonAdminUser(testClient)
        role = await createRole('role', organization, {
            permissions: [PermissionName.edit_my_organization_10331],
        }).save()

        await createOrganizationMembership({
            user: nonAdmin,
            organization,
            roles: [role],
        }).save()
        arbitraryUserToken = getNonAdminAuthToken()
    })

    describe('setBranding', () => {
        const mimetype = 'image/png'
        const encoding = '7bit'

        context('permissions', () => {
            function setBrandingCaller() {
                return setBranding(
                    testClient,
                    organizationId,
                    fs.createReadStream(resolve(`tests/fixtures/${filename}`)),
                    filename,
                    mimetype,
                    encoding,
                    '#cd657b',
                    { authorization: arbitraryUserToken }
                )
            }

            beforeEach(async () => {
                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .remove(PermissionName.edit_my_organization_10331)
            })
            it('rejects users with neither edit_my_organization_10331 or edit_this_organization_10330', async () => {
                await expect(setBrandingCaller()).to.be.rejected
            })
            it('allows users with edit_my_organization_10331', async () => {
                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .add(PermissionName.edit_my_organization_10331)

                await expect(setBrandingCaller()).to.be.fulfilled
            })
            it('allows users with edit_this_organization_10330', async () => {
                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .add(PermissionName.edit_this_organization_10330)

                await expect(setBrandingCaller()).to.be.fulfilled
            })
        })

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
                // todo: either test or code is broken, it does not throw an error
                it.skip('should throw an error', async () => {
                    const primaryColor = '#cd657b'

                    await expect(
                        setBrandingWithoutImage(
                            testClient,
                            organizationId,
                            primaryColor,
                            { authorization: arbitraryUserToken }
                        )
                    ).to.be.eventually.rejected

                    const organizationBranding = await Branding.findOne({
                        where: { organization: Equal(organization) },
                    })
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
                        where: { organization: Equal(organization) },
                    })
                    expect(brandings.length).to.equal(1)

                    const images = await BrandingImage.find({
                        where: {
                            branding: Equal(brandings[0]),
                            status: Status.ACTIVE,
                        },
                    })
                    expect(images.length).to.equal(1)
                })
            })

            context(
                'and primaryColor is not provided and iconImage is provided',
                () => {
                    it('should leave primaryColor as its current colour and update iconImage', async () => {
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
                        expect(branding.primaryColor).to.be.equal(primaryColor)

                        const brandings = await Branding.find({
                            where: { organization: Equal(organization) },
                        })
                        expect(brandings.length).to.equal(1)

                        const images = await BrandingImage.find({
                            where: {
                                branding: Equal(brandings[0]),
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
                            where: { organization: Equal(organization) },
                        })
                        expect(brandings.length).to.equal(1)

                        const images = await BrandingImage.find({
                            where: {
                                branding: Equal(brandings[0]),
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
        context('permissions', () => {
            function deleteBrandingImageCaller() {
                return deleteBrandingImageMutation(
                    testClient,
                    organizationId,
                    BrandingImageTag.ICON,
                    arbitraryUserToken
                )
            }

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

                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .remove(PermissionName.edit_my_organization_10331)
            })
            it('rejects users with neither edit_my_organization_10331 or edit_this_organization_10330', async () => {
                await expect(deleteBrandingImageCaller()).to.be.rejected
            })
            it('allows users with edit_my_organization_10331', async () => {
                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .add(PermissionName.edit_my_organization_10331)

                await expect(deleteBrandingImageCaller()).to.be.fulfilled
            })
            it('allows users with edit_this_organization_10330', async () => {
                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .add(PermissionName.edit_this_organization_10330)

                await expect(deleteBrandingImageCaller()).to.be.fulfilled
            })
        })
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

                const branding = await Branding.findOne({
                    where: {
                        organization: Equal(organization),
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding: Equal(branding), tag: type },
                })

                await expect(
                    deleteBrandingImageQuery(
                        testClient,
                        organizationId,
                        type,
                        arbitraryUserToken
                    )
                ).to.be.eventually.rejected
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

                const branding = await Branding.findOne({
                    where: {
                        organization: Equal(organization),
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding: Equal(branding), tag: type },
                })

                await expect(
                    deleteBrandingImageQuery(
                        testClient,
                        organizationId,
                        wrongType,
                        arbitraryUserToken
                    )
                ).to.be.eventually.rejected
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
                        organization: Equal(organization),
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding: Equal(branding), tag: type },
                })

                await expect(func()).to.be.eventually.rejected
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
                    const noneExistingId = NIL_UUID
                    const func = () =>
                        deleteBrandingImageQuery(
                            testClient,
                            noneExistingId,
                            type,
                            arbitraryUserToken
                        )

                    const branding = await Branding.findOne({
                        where: {
                            organization: Equal(organization),
                            status: Status.ACTIVE,
                        },
                    })

                    const brandingImage = await BrandingImage.findOne({
                        where: { branding: Equal(branding), tag: type },
                    })

                    await expect(func()).to.be.eventually.rejected
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
                        organization: Equal(organization),
                        status: Status.ACTIVE,
                    },
                })

                await expect(func()).to.be.eventually.rejected
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
                        organization: Equal(organization),
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding: Equal(branding), tag: type },
                })

                await expect(func()).to.be.eventually.rejected
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
                        organization: Equal(organization),
                        status: Status.ACTIVE,
                    },
                })

                const brandingImage = await BrandingImage.findOne({
                    where: { branding: Equal(branding), tag: type },
                })

                expect(result).eq(true)
                expect(branding).to.exist
                expect(brandingImage).to.exist
                expect(brandingImage?.status).eq(Status.INACTIVE)
            })
        })
    })

    describe('deleteBrandingColor', () => {
        let branding: Branding | null
        const primaryColor = '#cd657b'
        const iconImage = fs.createReadStream(
            resolve(`tests/fixtures/${filename}`)
        )

        context('permissions', () => {
            function deleteBrandingColorCaller() {
                return deleteBrandingColorMutation(
                    testClient,
                    organizationId,
                    arbitraryUserToken
                )
            }

            beforeEach(async () => {
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

                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .remove(PermissionName.edit_my_organization_10331)
            })
            it('rejects users with neither edit_my_organization_10331 or edit_this_organization_10330', async () => {
                await expect(deleteBrandingColorCaller()).to.be.rejected
            })
            it('allows users with edit_my_organization_10331', async () => {
                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .add(PermissionName.edit_my_organization_10331)

                await expect(deleteBrandingColorCaller()).to.be.fulfilled
            })
            it('allows users with edit_this_organization_10330', async () => {
                await Role.createQueryBuilder()
                    .relation('permissions')
                    .of(role)
                    .add(PermissionName.edit_this_organization_10330)

                await expect(deleteBrandingColorCaller()).to.be.fulfilled
            })
        })

        it('removes any set colour while leaving other properties unchanged', async () => {
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
                    organization: Equal(organization),
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
                where: { organization: Equal(organization) },
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

                await expect(func()).to.be.eventually.rejected
            })
        })
    })
})
