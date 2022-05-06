import { expect } from 'chai'
import { getConnection } from 'typeorm'
import { createServer } from '../../src/utils/createServer'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { TestConnection } from '../utils/testConnection'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import {
    addUserToOrganizationAndValidate,
    createSchool,
    createRole,
} from '../utils/operations/organizationOps'
import {
    addUserToSchool,
    getSchoolMembershipViaSchool,
} from '../utils/operations/schoolOps'
import {
    addRoleToSchoolMembership,
    addRolesToSchoolMembership,
    removeRoleToSchoolMembership,
    leaveSchool,
} from '../utils/operations/schoolMembershipOps'
import { getNonAdminAuthToken, getAdminAuthToken } from '../utils/testConfig'
import { School } from '../../src/entities/school'
import { Status } from '../../src/entities/status'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { Model } from '../../src/model'

describe('SchoolMembership', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    const roleInfo = (role: any) => {
        return role.role_id
    }
    let organizationId: string
    let userId: string
    let school: School
    let schoolId: string
    let schoolMembership: SchoolMembership

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        const orgOwner = await createAdminUser(testClient)
        userId = (await createNonAdminUser(testClient)).user_id
        organizationId = (
            await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id,
                'org 1'
            )
        ).organization_id
        school = await createSchool(
            testClient,
            organizationId,
            'school 1',
            undefined,
            { authorization: getAdminAuthToken() }
        )
        schoolId = school?.school_id
        await addUserToOrganizationAndValidate(
            testClient,
            userId,
            organizationId,
            { authorization: getAdminAuthToken() }
        )
        await addUserToSchool(testClient, userId, schoolId, {
            authorization: getAdminAuthToken(),
        })
        schoolMembership = await getSchoolMembershipViaSchool(
            testClient,
            schoolId,
            userId,
            { authorization: getAdminAuthToken() }
        )
    })

    describe('addRole', () => {
        let roleId: string

        beforeEach(async () => {
            const role = await createRole(testClient, organizationId)
            roleId = role?.role_id
        })

        context('when the school is active', () => {
            it('adds the role to the school membership', async () => {
                const role = await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    roleId
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })
                const dbRoles = (await dbMembership.roles) || []

                expect(role.role_id).to.eq(roleId)
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).to.deep.eq([roleId])
            })
        })

        context('when the school is inactive', () => {
            beforeEach(async () => {
                await leaveSchool(testClient, userId, schoolId, {
                    authorization: getNonAdminAuthToken(),
                })
            })

            it('does not add the role to the school membership', async () => {
                const role = await addRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    roleId
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })
                const dbRoles = (await dbMembership.roles) || []

                expect(role).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbRoles).to.be.empty
                expect(dbMembership.status_updated_at).to.not.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
            })
        })
    })

    describe('addRoles', () => {
        let roleId: string

        beforeEach(async () => {
            const role = await createRole(testClient, organizationId)
            roleId = role?.role_id
        })

        context('when the school is active', () => {
            it('adds the roles to the school membership', async () => {
                const roles = await addRolesToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    [roleId]
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })
                const dbRoles = (await dbMembership.roles) || []

                expect(roles.map(roleInfo)).to.deep.eq([roleId])
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).to.deep.eq([roleId])
            })
        })

        context('when the school is inactive', () => {
            beforeEach(async () => {
                await leaveSchool(testClient, userId, schoolId, {
                    authorization: getNonAdminAuthToken(),
                })
            })

            it('does not add the roles to the school membership', async () => {
                const roles = await addRolesToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    [roleId]
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })
                const dbRoles = (await dbMembership.roles) || []

                expect(roles).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbRoles).to.be.empty
                expect(dbMembership.status_updated_at).to.not.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
            })
        })
    })

    describe('removeRole', () => {
        let roleId: string

        beforeEach(async () => {
            const role = await createRole(testClient, organizationId)
            roleId = role?.role_id
            await addRoleToSchoolMembership(
                testClient,
                userId,
                schoolId,
                roleId
            )
        })

        context('when the school is active', () => {
            it('removes the role to the school membership', async () => {
                const gqlMembership = await removeRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    roleId
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })
                const dbRoles = (await dbMembership.roles) || []

                expect(gqlMembership.user_id).to.eq(userId)
                expect(gqlMembership.school_id).to.eq(schoolId)
                expect(dbMembership).not.to.be.null
                expect(dbRoles).to.be.empty
            })
        })

        context('when the school is inactive', () => {
            beforeEach(async () => {
                await leaveSchool(testClient, userId, schoolId, {
                    authorization: getNonAdminAuthToken(),
                })
            })

            it('adds the role to the school membership', async () => {
                const gqlMembership = await removeRoleToSchoolMembership(
                    testClient,
                    userId,
                    schoolId,
                    roleId
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })
                const dbRoles = (await dbMembership.roles) || []

                expect(gqlMembership).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbRoles.map(roleInfo)).to.deep.eq([roleId])
            })
        })
    })

    describe('leave', () => {
        let roleId: string

        beforeEach(async () => {
            const role = await createRole(testClient, organizationId)
            roleId = role?.role_id
            await addRoleToSchoolMembership(
                testClient,
                userId,
                schoolId,
                roleId
            )
        })

        context('when the school membership is active', () => {
            it('leaves the school membership', async () => {
                const leftGql = await leaveSchool(
                    testClient,
                    userId,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })

                expect(leftGql).to.be.true
                expect(dbMembership).not.to.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
                expect(dbMembership.status_updated_at).not.to.be.null
            })
        })

        context('when the school membership is inactive', () => {
            beforeEach(async () => {
                await leaveSchool(testClient, userId, schoolId, {
                    authorization: getNonAdminAuthToken(),
                })
            })

            it('does not leave the school membership', async () => {
                const leftGql = await leaveSchool(
                    testClient,
                    userId,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )
                const dbMembership = await SchoolMembership.findOneOrFail({
                    where: { user_id: userId, school_id: schoolId },
                })

                expect(leftGql).to.be.null
                expect(dbMembership).not.to.be.null
                expect(dbMembership.status).to.eq(Status.INACTIVE)
                expect(dbMembership.status_updated_at).not.to.be.null
            })
        })
    })
})
