import { stub, restore } from 'sinon'

import { expect } from 'chai'
import { Connection } from 'typeorm'
import { Model } from '../../src/model'
import { createTestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Organization } from '../../src/entities/organization'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { CloudStorageUploader } from '../../src/services/cloudStorageUploader'
import { accountUUID } from '../../src/entities/user'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { getAdminAuthToken, getNonAdminAuthToken } from '../utils/testConfig'
import { setBranding } from '../utils/operations/brandingOps'
import fs from 'fs'
import { resolve } from 'path'
import { createOrganization } from '../factories/organization.factory'
import { BrandingResult } from '../../src/types/graphQL/branding'

const GET_ORGANIZATIONS = `
    query getOrganizations {
        organizations {
            organization_id
            organization_name
            branding {
                iconImageURL
                primaryColor
            }
        }
    }
`

const GET_ORGANIZATION = `
    query myQuery($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            organization_id
            organization_name
            branding {
                iconImageURL
                primaryColor
              }
        }
    }
`

const RESET_ORGANIZATION_ROLES_PERMISSIONS = `
    mutation resetOrganizationRolesPermissions($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            resetDefaultRolesPermissions {
                role_id
                role_name
                permissions {
                    permission_name
                    role_id
                }
            }
        }
    }
`

describe('model.organization', () => {
    let connection: Connection
    let originalAdmins: string[]
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
        stub(CloudStorageUploader, 'call').returns(
            Promise.resolve('http://some.url/icon.png')
        )
    })

    after(async () => {
        restore()
        await connection?.close()
    })

    describe('getOrganizations', () => {
        context('when none', () => {
            it('should return an empty array', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: { authorization: getAdminAuthToken() },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const organizations = res.data?.organizations as Organization[]
                expect(organizations).to.exist
                expect(organizations).to.be.empty
            })
        })

        context('when one', () => {
            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                const organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
            })

            it('should return an array containing one organization', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: { authorization: getAdminAuthToken() },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const organizations = res.data?.organizations as Organization[]
                expect(organizations).to.exist
                expect(organizations).to.have.lengthOf(1)
            })
        })

        context('when many', () => {
            let orgs: Organization[] = []
            let brandings: BrandingResult[] = []

            beforeEach(async () => {
                await createNonAdminUser(testClient)
                const arbitraryUserToken = getNonAdminAuthToken()
                orgs = []
                brandings = []
                for (let i = 0; i < 3; i++) {
                    const org = await createOrganization()
                    org.organization_name = `org ${i}`
                    await connection.manager.save(org)

                    const branding = await setBranding(
                        testClient,
                        org.organization_id,
                        fs.createReadStream(resolve(`tests/fixtures/icon.png`)),
                        'icon.png',
                        'image/png',
                        '7bit',
                        `#${i.toString().repeat(6)}`,
                        { authorization: arbitraryUserToken }
                    )
                    brandings.push(branding)
                    orgs.push(org)
                }
            })

            it('returns all orgs with the correct data associated with each', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: { authorization: getAdminAuthToken() },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const organizations = res.data?.organizations
                expect(organizations).to.exist
                expect(organizations).to.have.lengthOf(orgs.length)

                for (let i = 0; i < orgs.length; i++) {
                    expect(orgs[i].organization_id).to.eq(
                        organizations[i].organization_id
                    )
                    expect(orgs[i].organization_name).to.eq(
                        organizations[i].organization_name
                    )
                    expect(organizations[i].branding.iconImageURL).to.eq(
                        brandings[i].iconImageURL
                    )
                    expect(organizations[i].branding.primaryColor).to.eq(
                        brandings[i].primaryColor
                    )
                }
            })
        })
    })

    describe('getOrganization', () => {
        context('when none', () => {
            it('should return null', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: accountUUID() },
                    headers: { authorization: getAdminAuthToken() },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                expect(res.data?.organization).to.be.null
            })
        })

        context('when one', () => {
            let organization: Organization

            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
            })

            it('should return an array containing one organization', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: {
                        organization_id: organization.organization_id,
                    },
                    headers: { authorization: getAdminAuthToken() },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const gqlOrganization = res.data?.organization as Organization
                expect(gqlOrganization).to.exist
                expect(gqlOrganization.organization_id).to.eq(
                    organization.organization_id
                )
            })

            context('branding', () => {
                let arbitraryUserToken: string

                beforeEach(async () => {
                    restore()

                    await createNonAdminUser(testClient)
                    arbitraryUserToken = getNonAdminAuthToken()
                })

                const primaryColor = '#cd657b'
                it('returns branding info if it has been set', async () => {
                    const remoteUrl = 'http://some.url/icon.png'
                    stub(CloudStorageUploader, 'call').returns(
                        Promise.resolve(remoteUrl)
                    )

                    const branding = await setBranding(
                        testClient,
                        organization.organization_id,
                        fs.createReadStream(resolve(`tests/fixtures/icon.png`)),
                        'icon.png',
                        'image/png',
                        '7bit',
                        primaryColor,
                        { authorization: arbitraryUserToken }
                    )
                    const { query } = testClient

                    const res = await query({
                        query: GET_ORGANIZATION,
                        variables: {
                            organization_id: organization.organization_id,
                        },
                        headers: { authorization: getAdminAuthToken() },
                    })

                    const data = res.data?.organization
                    expect(data.branding.primaryColor).to.eq(primaryColor)
                    expect(branding.iconImageURL).to.match(/.*\.png$/)
                })

                it('returns the latest branding info if it has been set multiple times', async () => {
                    let remoteUrl = 'http://some.url/icon.png'
                    stub(CloudStorageUploader, 'call').returns(
                        Promise.resolve(remoteUrl)
                    )

                    const { query } = testClient
                    let branding = await setBranding(
                        testClient,
                        organization.organization_id,
                        fs.createReadStream(resolve(`tests/fixtures/icon.png`)),
                        'icon.png',
                        'image/png',
                        '7bit',
                        primaryColor,
                        { authorization: arbitraryUserToken }
                    )

                    let res = await query({
                        query: GET_ORGANIZATION,
                        variables: {
                            organization_id: organization.organization_id,
                        },
                        headers: { authorization: getAdminAuthToken() },
                    })

                    let data = res.data?.organization
                    expect(data.branding.primaryColor).to.eq(primaryColor)
                    expect(branding.iconImageURL).to.match(/.*\.png$/)

                    restore()
                    remoteUrl = 'http://some.url/icon.jpg'
                    stub(CloudStorageUploader, 'call').returns(
                        Promise.resolve(remoteUrl)
                    )

                    branding = await setBranding(
                        testClient,
                        organization.organization_id,
                        fs.createReadStream(resolve(`tests/fixtures/icon.jpg`)),
                        'icon.jpg',
                        'image/jpeg',
                        '7bit',
                        primaryColor,
                        { authorization: arbitraryUserToken }
                    )

                    res = await query({
                        query: GET_ORGANIZATION,
                        variables: {
                            organization_id: organization.organization_id,
                        },
                        headers: { authorization: getAdminAuthToken() },
                    })

                    data = res.data?.organization
                    expect(data.branding.primaryColor).to.eq(primaryColor)
                    expect(branding.iconImageURL).to.match(/.*\.jpg$/)
                })
            })
        })
    })
})
