import { expect } from 'chai'
import supertest from 'supertest'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { School } from '../../src/entities/school'
import { User } from '../../src/entities/user'
import { PermissionName } from '../../src/permissions/permissionNames'
import { studentRole } from '../../src/permissions/student'
import { OrganizationConnectionNode } from '../../src/types/graphQL/organization'
import { PermissionConnectionNode } from '../../src/types/graphQL/permission'
import { ISchoolsConnectionNode } from '../../src/types/graphQL/school'
import { IPaginatedResponse } from '../../src/utils/pagination/paginate'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createUser } from '../factories/user.factory'
import { userToPayload } from '../utils/operations/userOps'
import { generateToken } from '../utils/testConfig'
import { makeRequest } from './utils'

const url = 'http://localhost:8080/user'
const request = supertest(url)

describe('acceptance.myUser', () => {
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
            const token = generateToken(userToPayload(user))
            const response = await makeRequest(request, query, {}, token)
            expect(response.status).to.eq(200)
            expect(response.body.data.myUser.node.id).to.eq(user.user_id)
        })
        it('errors if the user is not found', async () => {
            const token = generateToken(userToPayload(createUser()))
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
            const token = generateToken(userToPayload(clientUser))
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
                const token = generateToken(userToPayload(clientUser))
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
                const token = generateToken(userToPayload(clientUser))
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
                const token = generateToken(userToPayload(clientUser))
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
                const token = generateToken(userToPayload(clientUser))
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
        let org3: Organization
        let role1: Role
        let role2: Role
        let role3: Role
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
            org3 = await createOrganization().save()
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

            role3 = await createRole(undefined, org1, {
                permissions: [
                    permissionIds[0],
                    PermissionName.view_classes_20114,
                ],
            }).save()

            const orgs = [org1, org2],
                roles = [role1, role2]

            for (let i = 0; i < orgs.length; i++) {
                await createOrganizationMembership({
                    user: clientUser,
                    organization: orgs[i],
                    roles: [roles[i], role3],
                }).save()
            }

            await createOrganizationMembership({
                user: clientUser,
                organization: org3,
                roles: [],
            }).save()

            token = generateToken(userToPayload(clientUser))
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
            let school3: School
            let school4: School

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
                school3 = await createSchool(org2).save()
                school4 = await createSchool(org3).save()

                const schools = [school1, school2],
                    roles = [role1, role2]
                for (let i = 0; i < schools.length; i++) {
                    await createSchoolMembership({
                        user: clientUser,
                        school: schools[i],
                        roles: [roles[i]],
                    }).save()
                }

                await createSchoolMembership({
                    user: clientUser,
                    school: school4,
                    roles: [],
                }).save()
            })

            it('fetches schools which the user has the checked permissions in', async () => {
                const response = await makeRequest(
                    request,
                    query,
                    {
                        permissionIds: [
                            PermissionName.view_users_40110,
                            PermissionName.view_school_classes_20117,
                            PermissionName.view_classes_20114,
                        ],
                        operator: 'OR',
                    },
                    token
                )

                const result = response.body.data.myUser
                    .schoolsWithPermissions as IPaginatedResponse<ISchoolsConnectionNode>

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.have.same.members([
                    school1.school_id,
                    school2.school_id,
                    school3.school_id,
                ])

                expect(
                    result.edges.map((e) => e.node['id'])
                ).to.not.have.members([school4.school_id])
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
    context('MyUser.permissionsInOrganization', () => {
        const query = `
            query PermissionsInOrganization($organizationId: ID!, $filter: PermissionFilter){
                myUser {
                    permissionsInOrganization(organizationId: $organizationId, filter: $filter) {
                        totalCount
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
            }
        `

        let clientUser: User
        let organization: Organization
        let token: string

        async function getResult(variables: Record<string, unknown>) {
            const response = await makeRequest(request, query, variables, token)
            return response.body.data.myUser
                .permissionsInOrganization as IPaginatedResponse<PermissionConnectionNode>
        }

        beforeEach(async () => {
            clientUser = await createUser().save()
            organization = await createOrganization().save()
            const role = await createRole(undefined, undefined, {
                permissions: studentRole.permissions,
            }).save()

            await createOrganizationMembership({
                user: clientUser,
                organization,
                roles: [role],
            }).save()

            token = generateToken(userToPayload(clientUser))
        })
        it('returns a paginated response of a users permissions in organizations', async () => {
            const data = await getResult({
                organizationId: organization.organization_id,
            })
            expect(data.totalCount).to.eq(studentRole.permissions.length)
            const permissionIds = data.edges.map((edge) => edge.node.id)
            expect(permissionIds).to.have.same.members(studentRole.permissions)
        })
    })

    context('MyUser.permissionsInSchool', () => {
        const query = `
            query PermissionsInSchool($schoolId: ID!, $filter: PermissionFilter){
                myUser {
                    permissionsInSchool(schoolId: $schoolId, filter: $filter) {
                        totalCount
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
            }
        `

        let clientUser: User
        let school: School
        let token: string

        async function getResult(variables: Record<string, unknown>) {
            const response = await makeRequest(request, query, variables, token)
            return response.body.data.myUser
                .permissionsInSchool as IPaginatedResponse<PermissionConnectionNode>
        }

        beforeEach(async () => {
            const org = await createOrganization().save()
            clientUser = await createUser().save()
            school = await createSchool(org).save()
            const role = await createRole(undefined, org, {
                permissions: studentRole.permissions,
            }).save()

            await createOrganizationMembership({
                organization: org,
                user: clientUser,
                roles: [role],
            }).save()

            await createSchoolMembership({
                user: clientUser,
                school,
                roles: [role],
            }).save()

            token = generateToken(userToPayload(clientUser))
        })
        it('returns a paginated response of a users permissions in schools', async () => {
            const data = await getResult({
                schoolId: school.school_id,
            })
            expect(data.totalCount).to.eq(studentRole.permissions.length)
            const permissionIds = data.edges.map((edge) => edge.node.id)
            expect(permissionIds).to.have.same.members(studentRole.permissions)
        })
    })
})
