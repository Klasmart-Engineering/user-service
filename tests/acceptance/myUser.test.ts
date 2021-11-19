import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { createUser } from '../factories/user.factory'
import { generateToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'
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

const url = 'http://localhost:8080/user'
const request = supertest(url)

describe('acceptance.myUser', () => {
    let connection: Connection

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
})
