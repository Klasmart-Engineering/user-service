import { expect } from 'chai'
import { Connection } from 'typeorm'
import { Model } from '../../src/model'
import { createTestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Organization } from '../../src/entities/organization'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createAdminUser } from '../utils/testEntities'
import { accountUUID } from '../../src/entities/user'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { getAdminAuthToken } from '../utils/testConfig'
import { setBranding } from '../utils/operations/brandingOps'
import fs from 'fs'
import { resolve } from 'path'
const GET_ORGANIZATIONS = `
    query getOrganizations {
        organizations {
            organization_id
            organization_name
            branding {
                iconImageURL
                faviconImageURL
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
                faviconImageURL
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
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
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
                const primaryColor = 'cd657b'
                it('returns branding info if it has been set', async () => {
                    const branding = await setBranding(
                        testClient,
                        organization.organization_id,
                        fs.createReadStream(resolve(`tests/fixtures/icon.png`)),
                        'icon.png',
                        'image/png',
                        '7bit',
                        primaryColor
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
                    const { query } = testClient
                    let branding = await setBranding(
                        testClient,
                        organization.organization_id,
                        fs.createReadStream(resolve(`tests/fixtures/icon.png`)),
                        'icon.png',
                        'image/png',
                        '7bit',
                        primaryColor
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

                    branding = await setBranding(
                        testClient,
                        organization.organization_id,
                        fs.createReadStream(resolve(`tests/fixtures/icon.jpg`)),
                        'icon.jpg',
                        'image/jpeg',
                        '7bit',
                        primaryColor
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
