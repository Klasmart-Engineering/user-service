import { expect } from 'chai'
import supertest from 'supertest'
import { v4 as uuid_v4 } from 'uuid'
import { getConnection } from 'typeorm'
import { Organization } from '../../src/entities/organization'
import { User } from '../../src/entities/user'
import { createUser, createUsers } from '../factories/user.factory'
import { ORGANIZATION_NODE } from '../utils/operations/modelOps'
import { userToPayload } from '../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../utils/testConfig'
import { TestConnection } from '../utils/testConnection'
import { print } from 'graphql'
import { Branding } from '../../src/entities/branding'
import { BrandingImage } from '../../src/entities/brandingImage'
import { createBrandingImage } from '../factories/brandingImage.factory'
import { createBranding } from '../factories/branding.factory'
import {
    AddUsersToOrganizationInput,
    CreateOrganizationInput,
    DeleteUsersFromOrganizationInput,
    OrganizationConnectionNode,
    ReactivateUsersFromOrganizationInput,
    RemoveUsersFromOrganizationInput,
} from '../../src/types/graphQL/organization'
import {
    createOrganization,
    createOrganizations,
} from '../factories/organization.factory'
import {
    createRole,
    createRole as roleFactory,
} from '../factories/role.factory'
import {
    ADD_USERS_TO_ORGANIZATIONS,
    CREATE_ORGANIZATIONS,
    REMOVE_USERS_FROM_ORGANIZATIONS,
} from '../utils/operations/organizationOps'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    createOrganizationMembership,
    createOrgMembershipsInManyOrgs,
} from '../factories/organizationMembership.factory'
import { createOrganizationOwnership } from '../factories/organizationOwnership.factory'
import { makeRequest } from './utils'
import { School } from '../../src/entities/school'
import { Class } from '../../src/entities/class'
import { createSchool } from '../factories/school.factory'
import { createClass } from '../factories/class.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Role } from '../../src/entities/role'
import faker from 'faker'
import { generateShortCode } from '../../src/utils/shortcode'
import { Status } from '../../src/entities/status'

const url = 'http://localhost:8080'
const request = supertest(url)

describe('acceptance.organization', () => {
    let user: User
    let organization: Organization
    let branding: Branding
    let school: School
    let class_: Class
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        user = await createUser().save()
        organization = await createOrganization(user).save()
        await createOrganizationMembership({
            user,
            organization,
        }).save()
        school = await createSchool(organization).save()
        class_ = await createClass([school], organization).save()
    })

    context('createOrganizations', () => {
        let adminUser: User
        let input: CreateOrganizationInput[]
        const orgCount = 5

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const users = await User.save(createUsers(orgCount))
            input = users.map((u) => {
                return {
                    userId: u.user_id,
                    organizationName: uuid_v4(), // using uuid to avoid name clashes
                    address1: faker.address.streetAddress(),
                    address2: faker.address.zipCode(),
                    phone: faker.phone.phoneNumber(),
                    shortcode: generateShortCode(),
                }
            })
        })

        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                CREATE_ORGANIZATIONS,
                { input },
                generateToken(userToPayload(adminUser))
            )

            const resOrgs: OrganizationConnectionNode[] =
                response.body.data.createOrganizations.organizations
            expect(response.status).to.eq(200)
            expect(resOrgs).to.have.length(orgCount)
        })

        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                CREATE_ORGANIZATIONS,
                { input: [{}] },
                generateToken(userToPayload(adminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(2)
            expect(response.body.errors[0].message).to.contain(
                'Field "userId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "organizationName" of required type "String!" was not provided.'
            )
        })
    })

    context('addUsersToOrganizations', () => {
        let adminUser: User
        let input: AddUsersToOrganizationInput[]
        const roleAndUserCount = 10
        const orgCount = 50

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const roles = []
            for (let i = 0; i < roleAndUserCount; i++) {
                roles.push(roleFactory(`Role ${i}`))
            }
            const users = createUsers(roleAndUserCount)
            await connection.manager.save([...users, ...roles])

            const organizations = []
            for (let i = 0; i < orgCount; i++) {
                organizations.push(createOrganization())
            }
            await connection.manager.save(organizations)

            input = []
            for (let i = 0; i < orgCount; i++) {
                input.push({
                    organizationId: organizations[i].organization_id,
                    organizationRoleIds: roles
                        .slice(2, 10)
                        .map((v) => v.role_id),
                    userIds: users.slice(1, 10).map((v) => v.user_id),
                })
            }
        })

        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const response = await makeRequest(
                    request,
                    ADD_USERS_TO_ORGANIZATIONS,
                    { input },
                    generateToken(userToPayload(adminUser))
                )
                const resOrgs: OrganizationConnectionNode[] =
                    response.body.data.addUsersToOrganizations.organizations
                expect(response.status).to.eq(200)
                expect(resOrgs.length).to.equal(orgCount)
            })
        })
    })

    context('removeUsersFromOrganizations', () => {
        let adminUser: User
        let input: RemoveUsersFromOrganizationInput[]
        const userCount = 8
        const orgCount = 2

        beforeEach(async () => {
            adminUser = await createUser({
                email: UserPermissions.ADMIN_EMAILS[0],
            }).save()
            const users = createUsers(userCount)
            await User.save(users)

            const orgs = createOrganizations(orgCount)
            await Organization.save(orgs)

            const memberships = createOrgMembershipsInManyOrgs(users, orgs)
            await OrganizationMembership.save(memberships)

            input = orgs.map((o) => {
                return {
                    organizationId: o.organization_id,
                    userIds: users.map((v) => v.user_id),
                }
            })
        })

        context('when data is requested in a correct way', () => {
            it('should respond with status 200', async () => {
                const response = await makeRequest(
                    request,
                    REMOVE_USERS_FROM_ORGANIZATIONS,
                    { input },
                    generateToken(userToPayload(adminUser))
                )
                const resOrgs: OrganizationConnectionNode[] =
                    response.body.data.removeUsersFromOrganizations
                        .organizations
                expect(response.status).to.eq(200)
                expect(resOrgs.length).to.equal(orgCount)
            })
        })
    })

    context('reactivateUsersFromOrganizations', () => {
        let clientUser: User
        let input: ReactivateUsersFromOrganizationInput[]
        const userCount = 2
        const orgCount = 2

        beforeEach(async () => {
            clientUser = await createUser().save()
            const users = createUsers(userCount)
            await User.save(users)

            const orgs = createOrganizations(orgCount)
            await Organization.save(orgs)
            for (const org of orgs) {
                await createRole(undefined, org, {
                    permissions: [PermissionName.reactivate_user_40884],
                })
                    .save()
                    .then((role) => {
                        return createOrganizationMembership({
                            user: clientUser,
                            organization: org,
                            roles: [role],
                        }).save()
                    })
            }

            const memberships = createOrgMembershipsInManyOrgs(users, orgs)
            for (const membership of memberships) {
                membership.status = Status.INACTIVE
            }
            await OrganizationMembership.save(memberships)

            input = orgs.map((o) => {
                return {
                    organizationId: o.organization_id,
                    userIds: users.map((v) => v.user_id),
                }
            })
        })

        const REACTIVATE_USERS_FROM_ORGANIZATION = `
            mutation myMutation($input: [ReactivateUsersFromOrganizationInput!]!, $me: UUID!) {
                reactivateUsersFromOrganizations(input: $input) {
                    organizations{
                        id,
                        organizationMembershipsConnection(filter: {userId: {operator: neq, value: $me}}){
                            edges{
                                node {
                                    status
                                }
                            }
                        }
                    }
                }
            }
        `

        it('should respond with status 200', async () => {
            const response = await makeRequest(
                request,
                REACTIVATE_USERS_FROM_ORGANIZATION,
                { input, me: clientUser.user_id },
                generateToken(userToPayload(clientUser))
            )
            const resOrgs: OrganizationConnectionNode[] =
                response.body.data.reactivateUsersFromOrganizations
                    .organizations
            expect(response.status).to.eq(200)
            expect(resOrgs.length).to.equal(orgCount)
            for (const org of resOrgs) {
                expect(
                    org.organizationMembershipsConnection?.edges
                ).to.have.length(userCount)
                for (const node of org.organizationMembershipsConnection!.edges.map(
                    (e) => e.node
                )) {
                    expect(node.status).to.eq(Status.ACTIVE)
                }
            }
        })
    })

    context('deleteUsersFromOrganizations', () => {
        let clientUser: User
        let input: DeleteUsersFromOrganizationInput[]
        const userCount = 2
        const orgCount = 2

        beforeEach(async () => {
            clientUser = await createUser().save()
            const users = createUsers(userCount)
            await User.save(users)

            const orgs = createOrganizations(orgCount)
            await Organization.save(orgs)
            for (const org of orgs) {
                await createRole(undefined, org, {
                    permissions: [PermissionName.delete_users_40440],
                })
                    .save()
                    .then((role) => {
                        return createOrganizationMembership({
                            user: clientUser,
                            organization: org,
                            roles: [role],
                        }).save()
                    })
            }

            const memberships = createOrgMembershipsInManyOrgs(users, orgs)
            await OrganizationMembership.save(memberships)

            input = orgs.map((o) => {
                return {
                    organizationId: o.organization_id,
                    userIds: users.map((v) => v.user_id),
                }
            })
        })

        const DELETE_USERS_FROM_ORGANIZATION = `
            mutation myMutation($input: [DeleteUsersFromOrganizationInput!]!, $me: UUID!) {
                deleteUsersFromOrganizations(input: $input) {
                    organizations{
                        id,
                        organizationMembershipsConnection(filter: {userId: {operator: neq, value: $me}}){
                            edges{
                                node {
                                    status
                                }
                            }
                        }
                    }
                }
            }
        `

        it('should respond with status 200', async () => {
            const response = await makeRequest(
                request,
                DELETE_USERS_FROM_ORGANIZATION,
                { input, me: clientUser.user_id },
                generateToken(userToPayload(clientUser))
            )
            const resOrgs: OrganizationConnectionNode[] =
                response.body.data.deleteUsersFromOrganizations.organizations
            expect(response.status).to.eq(200)
            expect(resOrgs.length).to.equal(orgCount)
            for (const org of resOrgs) {
                expect(
                    org.organizationMembershipsConnection?.edges
                ).to.have.length(userCount)
                for (const node of org.organizationMembershipsConnection!.edges.map(
                    (e) => e.node
                )) {
                    expect(node.status).to.eq(Status.DELETED)
                }
            }
        })
    })

    context('organizationNode', () => {
        beforeEach(async () => {
            await createOrganizationOwnership({ user, organization }).save()
            await createOrganizationMembership({ user, organization }).save()

            const brandingImage1 = await createBrandingImage().save()
            branding = createBranding(organization)
            branding.primaryColor = '#118ab2'
            branding.images = [brandingImage1]
            await branding.save()
        })

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

    context('organizationsConnection', () => {
        it('supports filtering on expected fields', async () => {
            const query = `
                query organizationsConnection($filter: OrganizationFilter) {
                    organizationsConnection(direction: FORWARD, filter: $filter){
                        totalCount
                    }
                }`

            const uuidFilter = {
                operator: 'eq',
                value: uuid_v4(),
            }
            const stringFilter = {
                operator: 'eq',
                value: 'doesnt matter',
            }

            const response = await makeRequest(
                request,
                query,
                {
                    filter: {
                        id: uuidFilter,
                        name: stringFilter,
                        phone: stringFilter,
                        shortCode: stringFilter,
                        status: {
                            operator: 'eq',
                            value: 'active',
                        },
                        ownerUserId: uuidFilter,
                        ownerUserEmail: stringFilter,
                        ownerUsername: stringFilter,
                        userId: uuidFilter,
                    },
                },
                getAdminAuthToken()
            )
            expect(response.statusCode).to.eq(200)
            expect(response.body.errors).to.be.undefined
        })

        it('has rolesConnection as a child', async () => {
            const query = `
                query organizationsConnection($direction: ConnectionDirection!) {
                    organizationsConnection(direction:$direction){
                        edges {
                            node {
                                rolesConnection{
                                    totalCount
                                    edges{
                                        node{
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`

            const role = await roleFactory('role', organization).save()
            const sytemRolesCount = await Role.count({
                where: { system_role: true },
            })

            const token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                },
                token
            )
            expect(response.status).to.eq(200)
            expect(
                response.body.data.organizationsConnection.edges[0].node
                    .rolesConnection.totalCount
            ).to.eq(1 + sytemRolesCount)
        })

        it('has classesConnection as a child', async () => {
            const query = `
                query organizationsConnection($direction: ConnectionDirection!) {
                    organizationsConnection(direction:$direction){
                        edges {
                            node {
                                classesConnection {
                                    edges {
                                        node {
                                            id
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`

            const role = await createRole(undefined, undefined, {
                permissions: [
                    PermissionName.view_classes_20114,
                    PermissionName.view_school_classes_20117,
                ],
            }).save()

            const nonAdminUser = await createUser().save()
            await createOrganizationMembership({
                user: nonAdminUser,
                organization,
                roles: [role],
            }).save()

            const token = generateToken({
                id: nonAdminUser.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })

            const response = await makeRequest(
                request,
                query,
                {
                    direction: 'FORWARD',
                },
                token
            )

            expect(response.status).to.eq(200)
            expect(
                response.body.data.organizationsConnection.edges[0].node
                    .classesConnection.edges[0].node.id
            ).to.eq(class_.class_id)
        })
    })
})
