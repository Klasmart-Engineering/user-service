import faker from 'faker'
import { User } from '../../../src/entities/user'
import { createUser } from '../../factories/user.factory'
import { createOrganization } from '../../factories/organization.factory'
import { getRepository, getConnection } from 'typeorm'
import { TestConnection } from '../../utils/testConnection'
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
import { Organization } from '../../../src/entities/organization'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { createSchool } from '../../factories/school.factory'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'

describe('usersConnection loaders', async () => {
    let connection: TestConnection
    let usersList: User[] = []
    let userIds: string[]
    let org1: Organization
    let role1: Role
    let school1: School

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        usersList = await connection.manager.save(
            Array(10).fill(undefined).map(createUser)
        )

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
            await connection.manager.save(
                usersList.map((user) => {
                    return createOrganizationMembership({
                        user,
                        organization: org1,
                        roles: [role1],
                    })
                })
            )
        })

        it('always returns an array with equal length to the usersIds array', async () => {
            const userOrgs = await orgsForUsers(userIds)
            expect(userOrgs.length).to.equal(userIds.length)
        })

        it('returns an empty array for a user_id with no memberships', async () => {
            const userOrgs = await orgsForUsers([
                userIds[0],
                faker.datatype.uuid(),
            ])
            expect(userOrgs).to.have.length(2)
            expect(userOrgs[1]).to.deep.equal([])
        })

        it('returns the expected data format', async () => {
            const userOrgs = await orgsForUsers(userIds)

            await Promise.all(
                userIds.map(async (userId, index) => {
                    const orgs = userOrgs[index]
                    for (const org of orgs) {
                        const membership = await getRepository(
                            OrganizationMembership
                        ).findOneOrFail({
                            user_id: userId,
                            organization_id: org1.organization_id,
                        })
                        expect(org.id).to.equal(org1.organization_id)
                        expect(org.name).to.equal(org1.organization_name)
                        expect(org.joinDate?.valueOf()).to.equal(
                            membership?.join_timestamp?.valueOf()
                        )
                        expect(org.status).to.equal(org1.status)
                        expect(org.userStatus).to.equal(membership?.status)
                        expect(org.userShortCode).to.equal(
                            membership?.shortcode
                        )
                    }
                })
            )
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
        ;([
            {
                schoolId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
            {
                userId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
            {
                phone: {
                    operator: 'eq',
                    value: '+123',
                },
            },
            {
                classId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
        ] as IEntityFilter[]).forEach((filter) =>
            it(`does not filter OrganizationMemberships by ${
                Object.keys(filter)[0]
            }`, async () => {
                const userOrgs = await orgsForUsers(userIds, filter)
                expect(userOrgs).to.have.length(usersList.length)
                userOrgs.forEach((orgs) => expect(orgs).to.have.length(1))
            })
        )
        it('makes the expected number of queries to the database', async () => {
            connection.logger.reset()
            await orgsForUsers(userIds)
            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('schoolsForUsers', () => {
        beforeEach(async () => {
            await connection.manager.save(
                usersList.map((user) => {
                    return createSchoolMembership({
                        user,
                        school: school1,
                        roles: [role1],
                    })
                })
            )
        })
        it('always returns an array with equal length to the usersIds array', async () => {
            const userSchools = await schoolsForUsers(userIds)
            expect(userSchools.length).to.equal(userIds.length)
        })

        it('returns an empty array for a user_id with no memberships', async () => {
            const userSchools = await schoolsForUsers([
                userIds[0],
                faker.datatype.uuid(),
            ])
            expect(userSchools).to.have.length(2)
            expect(userSchools[1]).to.deep.equal([])
        })

        it('returns the expected data format', async () => {
            const userSchools = await schoolsForUsers(userIds)
            await Promise.all(
                userIds.map(async (userId, index) => {
                    const schools = userSchools[index]
                    for (const school of schools) {
                        const membership = await getRepository(
                            SchoolMembership
                        ).findOneOrFail({
                            user_id: userId,
                            school_id: school1.school_id,
                        })
                        expect(school.id).to.equal(school1.school_id)
                        expect(school.name).to.equal(school1.school_name)
                        expect(school.organizationId).to.equal(
                            org1.organization_id
                        )
                        expect(school.status).to.equal(school1.status)
                        expect(school.userStatus).to.equal(membership.status)
                    }
                })
            )
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
        ;([
            {
                schoolId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
            {
                roleId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
            {
                organizationUserStatus: {
                    operator: 'eq',
                    value: Status.INACTIVE,
                },
            },
            {
                userId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
            {
                phone: {
                    operator: 'eq',
                    value: '+123',
                },
            },
            {
                classId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
        ] as IEntityFilter[]).forEach((filter) =>
            it(`does not filter SchoolMemberships by ${
                Object.keys(filter)[0]
            }`, async () => {
                const userSchools = await schoolsForUsers(userIds, filter)
                expect(userSchools).to.have.length(usersList.length)
                userSchools.forEach((schoolNode) =>
                    expect(schoolNode).to.have.length(1)
                )
            })
        )
        it('makes the expected number of queries to the database', async () => {
            connection.logger.reset()
            await schoolsForUsers(userIds)
            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('rolesForUsers', () => {
        beforeEach(async () => {
            await connection.manager.save(
                usersList.map((user) => {
                    return createOrganizationMembership({
                        user,
                        organization: org1,
                        roles: [role1],
                    })
                })
            )

            await connection.manager.save(
                usersList.map((user) => {
                    return createSchoolMembership({
                        user,
                        school: school1,
                        roles: [role1],
                    })
                })
            )
        })

        it('always returns an array with equal length to the usersIds array', async () => {
            const userRoles = await rolesForUsers(userIds)
            expect(userRoles.length).to.equal(userIds.length)
        })

        it('returns an empty array for a user_id with no roles', async () => {
            const userRoles = await rolesForUsers([
                userIds[0],
                faker.datatype.uuid(),
            ])
            expect(userRoles).to.have.length(2)
            expect(userRoles[1]).to.deep.equal([])
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
                    } else if (role.organizationId) {
                        expect(role.organizationId).to.equal(
                            org1.organization_id
                        )
                    } else {
                        expect.fail(
                            'Either `organizationId` or `schoolId` should be populated'
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
        ;([
            {
                roleId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
            {
                organizationUserStatus: {
                    operator: 'eq',
                    value: Status.INACTIVE,
                },
            },
            {
                userId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
            {
                phone: {
                    operator: 'eq',
                    value: '+123',
                },
            },
            {
                classId: {
                    operator: 'eq',
                    value: faker.datatype.uuid(),
                },
            },
        ] as IEntityFilter[]).forEach((filter) =>
            it(`does not filter Roles by ${
                Object.keys(filter)[0]
            }`, async () => {
                const userRoles = await rolesForUsers(userIds, filter)
                expect(userRoles).to.have.length(usersList.length)
                userRoles.forEach((roleNode) =>
                    // School Role + Organization Role
                    expect(roleNode).to.have.length(2)
                )
            })
        )
        it('makes the expected number of queries to the database', async () => {
            connection.logger.reset()
            await rolesForUsers(userIds)
            // one for the organization roles, one for the schools
            expect(connection.logger.count).to.be.eq(2)
        })
    })
})
