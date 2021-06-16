import fs from 'fs'
import chaiAsPromised from 'chai-as-promised'
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
import { getBranding, setBranding } from '../utils/operations/brandingOps'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createAdminUser } from '../utils/testEntities'
import { Branding } from '../../src/entities/branding'
import { BrandingImage } from '../../src/entities/brandingImage'

describe('model.branding', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    const filename = 'icon.png'
    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })
    let organizationId: string
    beforeEach(async () => {
        const user = await createAdminUser(testClient)
        const organization = await createOrganizationAndValidate(
            testClient,
            user.user_id
        )
        organizationId = organization.organization_id
    })
    describe('setBranding', () => {
        let file: ReadStream
        const mimetype = 'image/png'
        const encoding = '7bit'
        context(
            'when the parameters and input file are correctly specified.',
            () => {
                it('should succeed in setting the branding', async () => {
                    const primaryColor = 'cd657b'
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
                    expect(images.length).to.equal(2)
                })
            }
        )
        context('when the file is the wrong mime type', () => {
            it('should fail in setting the branding and not create new db records', async () => {
                const primaryColor = 'cd657b'
                const iconImage = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                try {
                    const branding = await setBranding(
                        testClient,
                        organizationId,
                        iconImage,
                        filename,
                        'application/pdf',
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
    })
    describe('branding', () => {
        let file: ReadStream
        const mimetype = 'image/png'
        const encoding = '7bit'
        beforeEach(async () => {
            const primaryColor = 'cd657b'
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
        })
        context('when the organization exists and has branding.', () => {
            it('should return a branding record', async () => {
                const branding = await getBranding(testClient, organizationId)
                expect(branding).to.exist
                expect(branding.primaryColor).to.equal('cd657b')
                expect(branding.iconImageURL).to.match(/.*\.png$/)
            })
        })
        context('when the organization has two branding images', () => {
            beforeEach(async () => {
                const primaryColor = 'cd657b'
                const iconImage = fs.createReadStream(
                    resolve(`tests/fixtures/icon.jpg`)
                )
                const branding = await setBranding(
                    testClient,
                    organizationId,
                    iconImage,
                    'icon.jpg',
                    'image/jpeg',
                    encoding,
                    primaryColor
                )
            })
            it('should return a branding icon url with the latest image', async () => {
                const images = await BrandingImage.find()
                expect(images.length).to.equal(4)
                const branding = await getBranding(testClient, organizationId)
                expect(branding).to.exist
                expect(branding.primaryColor).to.equal('cd657b')
                expect(branding.iconImageURL).to.match(/.*\.jpeg$/)
            })
        })
    })
})
