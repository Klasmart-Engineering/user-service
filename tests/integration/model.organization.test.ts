import { stub, restore } from 'sinon'

import { expect, use } from 'chai'
import { getConnection, SelectQueryBuilder } from 'typeorm'
import { Model } from '../../src/model'
import { TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Organization } from '../../src/entities/organization'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../utils/operations/userOps'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { CloudStorageUploader } from '../../src/services/cloudStorageUploader'
import { accountUUID, User } from '../../src/entities/user'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { setBranding } from '../utils/operations/brandingOps'
import fs from 'fs'
import { resolve } from 'path'
import { createOrganization } from '../factories/organization.factory'
import { BrandingResult } from '../../src/types/graphQL/branding'
import faker from 'faker'
import {
    createAdminUser as adminFactory,
    createUser,
} from '../factories/user.factory'
import { createEntityScope } from '../../src/directives/isAdmin'
import { UserPermissions } from '../../src/permissions/userPermissions'
import chaiAsPromised from 'chai-as-promised'
import { Context } from '../../src/main'
import { compareEntityToPartial } from '../utils/assertions'

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

use(chaiAsPromised)

describe('model.organization', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
        stub(CloudStorageUploader, 'call').returns(
            Promise.resolve('http://some.url/icon.png')
        )
    })

    after(async () => {
        restore()
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
                await createAdminUser(testClient)
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
                        { authorization: getAdminAuthToken() }
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
        let organization: Organization
        let adminToken: string

        beforeEach(async () => {
            const adminUser = await adminFactory().save()
            organization = await createOrganization(adminUser).save()
            adminToken = generateToken(userToPayload(adminUser))
        })

        context('when none', () => {
            it('should return null', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: accountUUID() },
                    headers: { authorization: adminToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                expect(res.data?.organization).to.be.null
            })
        })

        context('when one', () => {
            it('should return an array containing one organization', async () => {
                const { query } = testClient

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: {
                        organization_id: organization.organization_id,
                    },
                    headers: { authorization: adminToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined
                const gqlOrganization = res.data?.organization as Organization
                expect(gqlOrganization).to.exist
                expect(gqlOrganization.organization_id).to.eq(
                    organization.organization_id
                )
            })

            context('branding', () => {
                beforeEach(async () => {
                    restore()
                    await createNonAdminUser(testClient)
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
                        { authorization: adminToken }
                    )
                    const { query } = testClient

                    const res = await query({
                        query: GET_ORGANIZATION,
                        variables: {
                            organization_id: organization.organization_id,
                        },
                        headers: { authorization: adminToken },
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
                        { authorization: adminToken }
                    )

                    let res = await query({
                        query: GET_ORGANIZATION,
                        variables: {
                            organization_id: organization.organization_id,
                        },
                        headers: { authorization: adminToken },
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
                        { authorization: adminToken }
                    )

                    res = await query({
                        query: GET_ORGANIZATION,
                        variables: {
                            organization_id: organization.organization_id,
                        },
                        headers: { authorization: adminToken },
                    })

                    data = res.data?.organization
                    expect(data.branding.primaryColor).to.eq(primaryColor)
                    expect(branding.iconImageURL).to.match(/.*\.jpg$/)
                })
            })
        })

        context('when not authorized', () => {
            let model: Model
            let scope: SelectQueryBuilder<Organization>

            beforeEach(async () => {
                const nonAdmin = await createUser().save()
                const permissions = new UserPermissions(userToPayload(nonAdmin))
                model = new Model(connection)
                scope = (await createEntityScope({
                    permissions,
                    entity: 'organization',
                })) as SelectQueryBuilder<Organization>
            })

            it('should return null', async () => {
                const orgResult = await model.getOrganization({
                    organization_id: organization.organization_id,
                    scope,
                })

                expect(orgResult).to.be.null
            })
        })
    })

    describe('setOrganization', () => {
        type SetOrganizationArgs = Pick<
            Organization,
            | 'organization_id'
            | 'organization_name'
            | 'address1'
            | 'address2'
            | 'phone'
            | 'shortCode'
        > & { scope: SelectQueryBuilder<Organization> }

        let organization: Organization
        let model: Model
        let ctx: Context
        let mutationArgs: SetOrganizationArgs

        beforeEach(async () => {
            const adminUser = await adminFactory().save()
            organization = await createOrganization(adminUser).save()
            model = new Model(connection)

            const permissions = new UserPermissions(userToPayload(adminUser))
            ctx = { permissions } as Context
            const scope = (await createEntityScope({
                permissions,
                entity: 'organization',
            })) as SelectQueryBuilder<Organization>

            mutationArgs = {
                organization_id: organization.organization_id,
                organization_name: faker.name.findName(),
                address1: faker.address.streetAddress(),
                address2: faker.address.streetAddress(),
                phone: faker.phone.phoneNumber('+44#######'),
                shortCode: 'N3W5H0R7',
                scope,
            }
        })

        context('when none', () => {
            it('should return null', async () => {
                const nonExistentOrgId = accountUUID()
                mutationArgs.organization_id = nonExistentOrgId

                const orgResult = await model.setOrganization(mutationArgs, ctx)
                expect(orgResult).to.be.null
            })
        })

        context('when one', () => {
            it('should return an array containing the organization with its new data', async () => {
                const orgResult = await model.setOrganization(mutationArgs, ctx)

                // Getting out scope prop, beacuse it doesn't exist for Organization
                const { scope, ...args } = mutationArgs
                expect(orgResult).to.exist
                compareEntityToPartial(orgResult!, args)

                const orgDB = await Organization.findOneByOrFail({
                    organization_id: mutationArgs.organization_id,
                })
                expect(orgDB).to.exist
                compareEntityToPartial(orgDB, args)
            })
        })

        context('when not authorized', () => {
            let nonAuthorizedUser: User
            let nonAuthorizedCtx: Context

            beforeEach(async () => {
                nonAuthorizedUser = await createUser().save()
                const permissions = new UserPermissions(
                    userToPayload(nonAuthorizedUser)
                )

                nonAuthorizedCtx = { permissions } as Context
            })

            it('should return error', async () => {
                const orgResult = model.setOrganization(
                    mutationArgs,
                    nonAuthorizedCtx
                )

                await expect(orgResult).to.be.rejectedWith(
                    `User(${nonAuthorizedUser.user_id}) does not have Permission(edit_this_organization_10330 OR edit_my_organization_10331) in Organization(${mutationArgs.organization_id})`
                )
            })
        })
    })
})
