import { User } from '../../../src/entities/user'
import { createUser } from '../../factories/user.factory'
import { createOrganization } from '../../factories/organization.factory'
import { Connection, getRepository } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { createTestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { Model } from '../../../src/model'
import {
    addOrganizationToUserAndValidate,
    addSchoolToUser,
} from '../../utils/operations/userOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import {
    orgsForUsers,
    schoolsForUsers,
    rolesForUsers,
} from '../../../src/loaders/usersConnection'
import { expect } from 'chai'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Status } from '../../../src/entities/status'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createRole } from '../../factories/role.factory'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import { Organization } from '../../../src/entities/organization'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { createSchool } from '../../factories/school.factory'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { addRoleToSchoolMembership } from '../../utils/operations/schoolMembershipOps'

describe('usersConnection loaders', async () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    let usersList: User[] = []
    let userIds: string[]
    let org1: Organization
    let role1: Role
    let school1: School

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        usersList = []
        for (let i = 0; i < 10; i++) {
            usersList.push(createUser())
            await connection.manager.save(usersList)
        }
        userIds = usersList.map((u) => u.user_id)
        org1 = createOrganization()
        org1.status = Status.INACTIVE
        await connection.manager.save(org1)
        school1 = createSchool(org1, 'school 1')
        school1.status = Status.INACTIVE
        await connection.manager.save(school1)
        role1 = createRole('role 1', org1)
        await connection.manager.save(role1)
    })

    context('orgsForUsers', () => {
        beforeEach(async () => {
            for (const user of usersList) {
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    org1.organization_id,
                    getAdminAuthToken()
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    org1.organization_id,
                    role1.role_id,
                    { authorization: getAdminAuthToken() }
                )
            }
        })

        it('always returns an array with equal length to the usersIds array', async () => {
            const userOrgs = await orgsForUsers(userIds)
            expect(userOrgs.length).to.equal(userIds.length)
        })

        it('returns the expected data format', async () => {
            const userOrgs = await orgsForUsers(userIds)

            userIds.forEach(async (userId, index) => {
                const orgs = userOrgs[index]
                for (const org of orgs) {
                    const membership = await getRepository(
                        OrganizationMembership
                    ).findOneOrFail(undefined, {
                        where: {
                            user_id: userId,
                            organization_id: org1.organization_id,
                        },
                    })
                    expect(org.id).to.equal(org1.organization_id)
                    expect(org.name).to.equal(org1.organization_name)
                    expect(org.joinDate?.valueOf()).to.equal(
                        membership?.join_timestamp?.valueOf()
                    )
                    expect(org.status).to.equal(org1.status)
                    expect(org.userStatus).to.equal(membership?.status)
                }
            })
        })

        it('filters orgs by org ID', async () => {
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'neq',
                    value: org1.organization_id,
                },
            }
            const userOrgs = await orgsForUsers(userIds, filter)
            for (const orgs of userOrgs) {
                expect(orgs.length).to.equal(0)
            }
        })

        it('filters orgs by roles', async () => {
            const filter: IEntityFilter = {
                roleId: {
                    operator: 'neq',
                    value: role1.role_id,
                },
            }

            const userOrgs = await orgsForUsers(userIds, filter)
            for (const orgs of userOrgs) {
                expect(orgs.length).to.equal(0)
            }
        })

        it('ignores school filters', async () => {
            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'contains',
                    value: 'abc',
                },
            }
            const userOrgs = await orgsForUsers(userIds, filter)
            for (const orgs of userOrgs) {
                expect(orgs.length).to.equal(1)
            }
        })
    })

    context('schoolsForUsers', () => {
        beforeEach(async () => {
            for (const user of usersList) {
                await addSchoolToUser(
                    testClient,
                    user.user_id,
                    school1.school_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    user.user_id,
                    school1.school_id,
                    role1.role_id,
                    { authorization: getAdminAuthToken() }
                )
            }
        })
        it('always returns an array with equal length to the usersIds array', async () => {
            const userSchools = await schoolsForUsers(userIds)
            expect(userSchools.length).to.equal(userIds.length)
        })

        it('returns the expected data format', async () => {
            const userSchools = await schoolsForUsers(userIds)
            userIds.forEach(async (userId, index) => {
                const schools = userSchools[index]
                for (const school of schools) {
                    const membership = await getRepository(
                        SchoolMembership
                    ).findOneOrFail(undefined, {
                        where: {
                            user_id: userId,
                            school_id: school1.school_id,
                        },
                    })
                    expect(school.id).to.equal(school1.school_id)
                    expect(school.name).to.equal(school1.school_name)
                    expect(school.organizationId).to.equal(org1.organization_id)
                    expect(school.status).to.equal(school1.status)
                    expect(school.userStatus).to.equal(membership.status)
                }
            })
        })

        it('filters school by organizationId', async () => {
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'neq',
                    value: org1.organization_id,
                },
            }
            const userSchools = await schoolsForUsers(userIds, filter)
            for (const school of userSchools) {
                expect(school.length).to.equal(0)
            }
        })
        it('filters school by schoolId', async () => {
            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'neq',
                    value: school1.school_id,
                },
            }
            const userSchools = await schoolsForUsers(userIds, filter)
            for (const school of userSchools) {
                expect(school.length).to.equal(0)
            }
        })
        it('filters school by roleId', async () => {
            const filter: IEntityFilter = {
                roleId: {
                    operator: 'neq',
                    value: role1.role_id,
                },
            }
            const userSchools = await schoolsForUsers(userIds, filter)
            for (const school of userSchools) {
                expect(school.length).to.equal(0)
            }
        })
    })

    context('rolesForUsers', () => {
        beforeEach(async () => {
            for (const user of usersList) {
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    org1.organization_id,
                    getAdminAuthToken()
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    org1.organization_id,
                    role1.role_id,
                    { authorization: getAdminAuthToken() }
                )
                await addSchoolToUser(
                    testClient,
                    user.user_id,
                    school1.school_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    user.user_id,
                    school1.school_id,
                    role1.role_id,
                    { authorization: getAdminAuthToken() }
                )
            }
        })

        it('always returns an array with equal length to the usersIds array', async () => {
            const userRoles = await rolesForUsers(userIds)
            expect(userRoles.length).to.equal(userIds.length)
        })

        it('returns the expected data format', async () => {
            const userRoles = await rolesForUsers(userIds)
            for (const roles of userRoles) {
                expect(roles.length).to.equal(2)

                for (const role of roles) {
                    expect(role.id).to.equal(role1.role_id)
                    expect(role.name).to.equal(role1.role_name)
                    if (role.schoolId) {
                        expect(role.schoolId).to.equal(school1.school_id)
                    }
                    if (role.organizationId) {
                        expect(role.organizationId).to.equal(
                            org1.organization_id
                        )
                    }
                }
            }
        })

        it('filters roles by organizationId', async () => {
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'neq',
                    value: org1.organization_id,
                },
            }
            const userRoles = await rolesForUsers(userIds, filter)
            for (const roles of userRoles) {
                expect(roles.length).to.equal(0)
            }
        })
        it('filters roles by schoolId', async () => {
            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'neq',
                    value: school1.school_id,
                },
            }
            const userRoles = await rolesForUsers(userIds, filter)
            for (const roles of userRoles) {
                expect(roles.length).to.equal(1) // the org role
            }
        })
        it('filters roles by roleId', async () => {
            const filter: IEntityFilter = {
                roleId: {
                    operator: 'neq',
                    value: role1.role_id,
                },
            }
            const userRoles = await rolesForUsers(userIds, filter)
            for (const roles of userRoles) {
                expect(roles.length).to.equal(0)
            }
        })
    })
})
