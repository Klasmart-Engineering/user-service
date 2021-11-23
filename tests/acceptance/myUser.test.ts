import { expect } from 'chai'
import supertest from 'supertest'
import { createUser } from '../factories/user.factory'
import { generateToken } from '../utils/testConfig'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { v4 as uuid_v4 } from 'uuid'
import { User } from '../../src/entities/user'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { makeRequest } from './utils'
import { Organization } from '../../src/entities/organization'
import { createRole } from '../factories/role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { School } from '../../src/entities/school'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { Role } from '../../src/entities/role'
import { IPaginatedResponse } from '../../src/utils/pagination/paginate'
import { OrganizationConnectionNode } from '../../src/types/graphQL/organization'
import { ISchoolsConnectionNode } from '../../src/types/graphQL/school'
import { Context } from 'mocha'

const url = 'http://localhost:8080/user'
const request = supertest(url)

describe('acceptance.myUser', () => {
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('MyUser.node', () => {
        const query = `
            query {
                myUser {
                    node {
                        id
                    }
                }
            }
        `

        it('returns the user connection node for the active user', async () => {
            const user = await createUser().save()
            const token = generateToken({
                id: user.user_id,
                email: user.email,
                iss: 'calmid-debug',
            })
            const response = await makeRequest(request, query, {}, token)
            expect(response.status).to.eq(200)
            expect(response.body.data.myUser.node.id).to.eq(user.user_id)
        })
        it('errors if the user is not found', async () => {
            const token = generateToken({
                id: uuid_v4(),
                email: 'a@b.com',
                iss: 'calmid-debug',
            })
            const response = await makeRequest(request, query, {}, token)
            expect(response.status).to.eq(200)
            expect(response.body.errors).exist
        })
    })

    context('MyUser.profiles', () => {
        const query = `
            query {
                myUser {
                    profiles {
                        id
                    }
                }
            }
        `

        let clientUser: User
        let profile: User

        beforeEach(async () => {
            const organization = await createOrganization().save()
            clientUser = await createUser().save()
            profile = await createUser({ email: clientUser.email }).save()

            for (const user of [clientUser, profile]) {
                await createOrganizationMembership({
                    user,
                    organization,
                }).save()
            }
        })

        it('returns all active profiles for the active user', async () => {
            const token = generateToken({
                id: clientUser.user_id,
                email: clientUser.email,
                iss: 'calmid-debug',
            })
            const response = await makeRequest(request, query, {}, token)
            expect(response.body.data.myUser.profiles).to.have.length(2)
        })
    })

    context('MyUser.hasPermissions', () => {
        let clientUser: User
        let organization: Organization
        let orgWithoutClientUser: Organization
        let schoolWithClientUser: School
        let schoolWithoutClientUser: School

        beforeEach(async () => {
            organization = await createOrganization().save()
            orgWithoutClientUser = await createOrganization().save()
            schoolWithClientUser = await createSchool(organization).save()
            schoolWithoutClientUser = await createSchool(organization).save()
            clientUser = await createUser().save()
            const roleOrg = await createRole(undefined, undefined, {
                permissions: [
                    PermissionName.view_school_20110,
                    PermissionName.view_users_40110,
                ],
            }).save()
            const roleSchool = await createRole(undefined, undefined, {
                permissions: [PermissionName.view_school_calendar_512],
            }).save()

            await createOrganizationMembership({
                // clientUser is part of organization
                user: clientUser,
                organization,
                roles: [roleOrg],
            }).save()
            await createSchoolMembership({
                // clientUser is part of schoolWithClientUser
                user: clientUser,
                school: schoolWithClientUser,
                roles: [roleSchool],
            }).save()
        })

        context('...InOrganization', () => {
            const query = `
                query HasPermissionsInOrganization($organizationId: ID!, $permissionIds: [String!]!){
                    myUser {
                        hasPermissionsInOrganization(organizationId: $organizationId, permissionIds: $permissionIds) {
                            permissionId
                            allowed
                        }
                    }
                }
            `

            it('returns an array showing statuses of queried permissions in organization', async () => {
                const token = generateToken({
                    id: clientUser.user_id,
                    email: clientUser.email,
                    iss: 'calmid-debug',
                })
                const response = await makeRequest(
                    request,
                    query,
                    {
                        organizationId: organization.organization_id,
                        permissionIds: [
                            PermissionName.view_school_20110,
                            PermissionName.view_users_40110,
                            PermissionName.view_org_completed_assessments_424,
                        ],
                    },
                    token
                )
                const expectedUserPermissionsStatuses = [
                    {
                        permissionId: PermissionName.view_school_20110,
                        allowed: true,
                    },
                    {
                        permissionId: PermissionName.view_users_40110,
                        allowed: true,
                    },
                    {
                        permissionId:
                            PermissionName.view_org_completed_assessments_424,
                        allowed: false,
                    },
                ]

                expect(
                    response.body.data.myUser.hasPermissionsInOrganization
                ).to.have.deep.members(expectedUserPermissionsStatuses)
            })

            it('returns false statuses when an organization the user is not in has been queried for', async () => {
                const token = generateToken({
                    id: clientUser.user_id,
                    email: clientUser.email,
                    iss: 'calmid-debug',
                })
                const response = await makeRequest(
                    request,
                    query,
                    {
                        organizationId: orgWithoutClientUser.organization_id,
                        permissionIds: [
                            PermissionName.view_school_20110,
                            PermissionName.view_users_40110,
                        ],
                    },
                    token
                )
                const expectedUserPermissionsStatuses = [
                    {
                        permissionId: PermissionName.view_school_20110,
                        allowed: false,
                    },
                    {
                        permissionId: PermissionName.view_users_40110,
                        allowed: false,
                    },
                ]

                expect(
                    response.body.data.myUser.hasPermissionsInOrganization
                ).to.have.deep.members(expectedUserPermissionsStatuses)
            })
        })

        context('...InSchool', () => {
            const query = `
                query HasPermissionsInSchool($schoolId: ID!, $permissionIds: [String!]!){
                    myUser {
                        hasPermissionsInSchool(schoolId: $schoolId, permissionIds: $permissionIds) {
                            permissionId
                            allowed
                        }
                    }
                }
            `

            it('returns an array showing statuses of queried permissions in school', async () => {
                const token = generateToken({
                    id: clientUser.user_id,
                    email: clientUser.email,
                    iss: 'calmid-debug',
                })
                const response = await makeRequest(
                    request,
                    query,
                    {
                        schoolId: schoolWithClientUser.school_id,
                        permissionIds: [
                            PermissionName.view_school_calendar_512,
                            PermissionName.view_school_completed_assessments_426,
                        ],
                    },
                    token
                )
                const expectedUserPermissionsStatuses = [
                    {
                        permissionId: PermissionName.view_school_calendar_512,
                        allowed: true,
                    },
                    {
                        permissionId:
                            PermissionName.view_school_completed_assessments_426,
                        allowed: false,
                    },
                ]

                expect(
                    response.body.data.myUser.hasPermissionsInSchool
                ).to.have.deep.members(expectedUserPermissionsStatuses)
            })

            it('returns false statuses when a school the user is not in has been queried for', async () => {
                const token = generateToken({
                    id: clientUser.user_id,
                    email: clientUser.email,
                    iss: 'calmid-debug',
                })
                const response = await makeRequest(
                    request,
                    query,
                    {
                        schoolId: schoolWithoutClientUser.school_id,
                        permissionIds: [
                            PermissionName.view_school_calendar_512,
                            PermissionName.view_school_completed_assessments_426,
                        ],
                    },
                    token
                )
                const expectedUserPermissionsStatuses = [
                    {
                        permissionId: PermissionName.view_school_calendar_512,
                        allowed: false,
                    },
                    {
                        permissionId:
                            PermissionName.view_school_completed_assessments_426,
                        allowed: false,
                    },
                ]

                expect(
                    response.body.data.myUser.hasPermissionsInSchool
                ).to.have.deep.members(expectedUserPermissionsStatuses)
            })
        })
    })

    context('MyUser.XWithPermissions', () => {
        let clientUser: User
        let org1: Organization
        let org2: Organization
        let role1: Role
        let role2: Role
        let permissionIds: PermissionName[]
        let token: string

        beforeEach(async () => {
            clientUser = await createUser().save()
            permissionIds = [
                PermissionName.view_users_40110,
                PermissionName.view_school_classes_20117,
            ]

            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            role1 = await createRole(undefined, org1, {
                permissions: [
                    permissionIds[0],
                    PermissionName.view_school_20110, // Helper permission for showing school responses in schoolsWithPermissions
                ],
            }).save()

            role2 = await createRole(undefined, org2, {
                permissions: [
                    permissionIds[1],
                    PermissionName.view_school_20110, // Helper permission for showing school responses in schoolsWithPermissions
                ],
            }).save()

            const orgs = [org1, org2],
                roles = [role1, role2]

            for (let i = 0; i < orgs.length; i++) {
                await createOrganizationMembership({
                    user: clientUser,
                    organization: orgs[i],
                    roles: [roles[i]],
                }).save()
            }

            token = generateToken({
                id: clientUser.user_id,
                email: clientUser.email,
                iss: 'calmid-debug',
            })
        })

        context('Organizations', () => {
            const query = `
                    query OrgsWithPermissions($permissionIds: [String!]!, $operator: LogicalOperator, $direction: ConnectionDirection, $count: PageSize, $cursor: String, $sort: OrganizationSortInput, $filter: OrganizationFilter){
                        myUser {
                            organizationsWithPermissions(permissionIds: $permissionIds, operator: $operator, direction: $direction, count: $count, cursor: $cursor, sort: $sort, filter: $filter) {
                                edges {
                                    node {
                                        id
                                    }
                                }
                            }
                        }
                    }
                `

            it('fetches organizations which the user has the checked permissions in', async () => {
                const response = await makeRequest(
                    request,
                    query,
                    {
                        permissionIds: [
                            PermissionName.view_users_40110,
                            PermissionName.view_school_classes_20117,
                        ],
                        operator: 'OR',
                    },
                    token
                )

                const result = response.body.data.myUser
                    .organizationsWithPermissions as IPaginatedResponse<OrganizationConnectionNode>

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    org1.organization_id,
                    org2.organization_id,
                ])
            })

            it('errors with status 400 if the required arguments are not given', async () => {
                const response = await makeRequest(request, query, {}, token)

                expect(response.status).to.equal(400)
                expect(response.body.errors).to.have.length(1)
                expect(response.body.errors[0].message).to.equal(
                    `Variable "$permissionIds" of required type "[String!]!" was not provided.`
                )
            })
        })

        context('Schools', () => {
            let school1: School
            let school2: School

            const query = `
                    query SchoolsWithPermissions($permissionIds: [String!]!, $operator: LogicalOperator, $direction: ConnectionDirection, $count: PageSize, $cursor: String, $sort: SchoolSortInput, $filter: SchoolFilter){
                        myUser {
                            schoolsWithPermissions(permissionIds: $permissionIds, operator: $operator, direction: $direction, count: $count, cursor: $cursor, sort: $sort, filter: $filter) {
                                edges {
                                    node {
                                        id
                                    }
                                }
                            }
                        }
                    }
                `

            beforeEach(async () => {
                school1 = await createSchool(org1).save()
                school2 = await createSchool(org2).save()
                const schools = [school1, school2],
                    roles = [role1, role2]
                for (let i = 0; i < schools.length; i++) {
                    await createSchoolMembership({
                        user: clientUser,
                        school: schools[i],
                        roles: [roles[i]],
                    }).save()
                }
            })

            it('fetches schools which the user has the checked permissions in', async () => {
                const response = await makeRequest(
                    request,
                    query,
                    {
                        permissionIds: [
                            PermissionName.view_users_40110,
                            PermissionName.view_school_classes_20117,
                        ],
                        operator: 'OR',
                    },
                    token
                )

                const result = response.body.data.myUser
                    .schoolsWithPermissions as IPaginatedResponse<ISchoolsConnectionNode>

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([school1.school_id, school2.school_id])
            })

            it('errors with status 400 if the required arguments are not given', async () => {
                const response = await makeRequest(request, query, {}, token)

                expect(response.status).to.equal(400)
                expect(response.body.errors).to.have.length(1)
                expect(response.body.errors[0].message).to.equal(
                    `Variable "$permissionIds" of required type "[String!]!" was not provided.`
                )
            })
        })
    })
})
