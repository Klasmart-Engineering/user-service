import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { Organization } from '../../src/entities/organization'
import { User } from '../../src/entities/user'
import {
    createAdminUser,
    createUser,
    createUsers,
} from '../factories/user.factory'
import { ORGANIZATION_NODE } from '../utils/operations/modelOps'
import { userToPayload } from '../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { Branding } from '../../src/entities/branding'
import { BrandingImage } from '../../src/entities/brandingImage'
import { createOrg } from '../utils/operations/acceptance/acceptanceOps.test'
import { createBrandingImage } from '../factories/brandingImage.factory'
import { createBranding } from '../factories/branding.factory'
import {
    AddUsersToOrganizationInput,
    OrganizationConnectionNode,
} from '../../src/types/graphQL/organization'
import { createOrganization } from '../factories/organization.factory'
import { createRole as roleFactory } from '../factories/role.factory'
import { ADD_USERS_TO_ORGANIZATIONS } from '../utils/operations/organizationOps'
import { UserPermissions } from '../../src/permissions/userPermissions'

const url = 'http://localhost:8080'
const request = supertest(url)

describe('acceptance.organization', () => {
    let connection: Connection
    let user: User
    let organization: Organization
    let branding: Branding

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        user = await createUser().save()
        const orgResponse = await createOrg(
            user.user_id,
            'Organization One',
            getAdminAuthToken()
        )

        const orgId =
            orgResponse.body.data.user.createOrganization.organization_id

        organization = await Organization.findOneOrFail(orgId)

        const brandingImage1 = await createBrandingImage().save()
        branding = createBranding(organization)
        branding.primaryColor = '#118ab2'
        branding.images = [brandingImage1]
        await branding.save()
    })

    context('addUsersToOrganizations', () => {
        let adminUser: User
        let input: AddUsersToOrganizationInput[]
        const roleuser_count = 20
        const org_count = 50

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const roles = []
            for (let i = 0; i < roleuser_count; i++) {
                roles.push(roleFactory(`Role ${i}`))
            }
            const users = createUsers(roleuser_count)
            await connection.manager.save([...users, ...roles])

            const organizations = []
            for (let i = 0; i < org_count; i++) {
                organizations.push(createOrganization())
            }
            await connection.manager.save(organizations)

            const start_idx = Math.floor(Math.random() * (roleuser_count - 5))
            const end_idx = start_idx + 5

            input = []
            for (let i = 0; i < org_count; i++) {
                input.push({
                    organizationId: organizations[i].organization_id,
                    organizationRoleIds: roles
                        .slice(start_idx, end_idx)
                        .map((v) => v.role_id),
                    userIds: users
                        .slice(start_idx, end_idx)
                        .map((v) => v.user_id),
                })
            }
        })

        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: generateToken(userToPayload(adminUser)),
                    })
                    .send({
                        query: print(ADD_USERS_TO_ORGANIZATIONS),
                        variables: {
                            input,
                        },
                    })
                const resOrgs: OrganizationConnectionNode[] =
                    response.body.data.addUsersToOrganizations.organizations
                expect(response.status).to.eq(200)
                expect(resOrgs.length).to.equal(org_count)
            })
        })
    })

    context('organizationNode', () => {
        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const organizationId = organization.organization_id
                const response = await request
                    .post('/user')
                    .set({
                        ContentType: 'application/json',
                        Authorization: generateToken(userToPayload(user)),
                    })
                    .send({
                        query: print(ORGANIZATION_NODE),
                        variables: {
                            id: organizationId,
                        },
                    })

                const organizationNode = response.body.data.organizationNode

                expect(response.status).to.eq(200)
                expect(organizationNode.id).to.equal(
                    organization.organization_id
                )
                expect(organizationNode.name).to.equal(
                    organization.organization_name
                )
                expect(organizationNode.name).to.equal(
                    organization.organization_name
                )
                expect(organizationNode.status).to.equal(organization.status)
                expect(organizationNode.shortCode).to.equal(
                    organization.shortCode
                )
                expect(organizationNode.contactInfo.address1).to.equal(
                    organization.address1
                )
                expect(organizationNode.contactInfo.address2).to.equal(
                    organization.address2
                )
                expect(organizationNode.contactInfo.phone).to.equal(
                    organization.phone
                )

                const owners = organizationNode.owners
                const orgOwner = await organization.owner

                expect(owners[0].id).to.equal(orgOwner?.user_id)

                const brandingResult = organizationNode.branding
                const brandingImages = (await branding.images) as BrandingImage[]

                expect(brandingResult.primaryColor).to.equal(
                    branding.primaryColor
                )
                expect(brandingResult.iconImageURL).to.equal(
                    brandingImages[0].url
                )
            })
        })

        context(
            "when request is using a param that doesn't exist ('organizationId' instead of 'id')",
            () => {
                it('should respond with status 400', async () => {
                    const organizationId = organization.organization_id
                    const response = await request
                        .post('/user')
                        .set({
                            ContentType: 'application/json',
                            Authorization: generateToken(userToPayload(user)),
                        })

                        .send({
                            query: print(ORGANIZATION_NODE),
                            variables: {
                                organizationId,
                            },
                        })

                    const errors = response.body.errors
                    const data = response.body.data

                    expect(response.status).to.eq(400)
                    expect(errors).to.exist
                    expect(data).to.be.undefined
                })
            }
        )
    })
})
