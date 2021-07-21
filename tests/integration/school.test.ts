import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import { Model } from '../../src/model'
import { createServer } from '../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { addRoleToOrganizationMembership } from '../utils/operations/organizationMembershipOps'
import {
    addUserToOrganizationAndValidate,
    createSchool,
    createRole,
    createClassAndValidate,
} from '../utils/operations/organizationOps'
import {
    addUserToSchool,
    editPrograms,
    getSchoolClasses,
    getSchoolMembershipsViaSchool,
    getSchoolMembershipViaSchool,
    getSchoolOrganization,
    listPrograms,
    updateSchool,
    deleteSchool,
} from '../utils/operations/schoolOps'
import { createOrganizationAndValidate } from '../utils/operations/userOps'
import { createTestConnection } from '../utils/testConnection'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import { addRoleToSchoolMembership } from '../utils/operations/schoolMembershipOps'
import { PermissionName } from '../../src/permissions/permissionNames'
import { grantPermission } from '../utils/operations/roleOps'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { getNonAdminAuthToken, getAdminAuthToken } from '../utils/testConfig'
import { Organization } from '../../src/entities/organization'
import { Program } from '../../src/entities/program'
import { Class } from '../../src/entities/class'
import { School } from '../../src/entities/school'
import { accountUUID, User } from '../../src/entities/user'
import { Status } from '../../src/entities/status'
import { addSchoolToClass } from '../utils/operations/classOps'
import { createUserAndValidate } from '../utils/operations/modelOps'
import { createProgram } from '../factories/program.factory'
import chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

describe('school', () => {
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

    describe('organization', () => {
        let organizationId: string
        let schoolId: string
        let school: School

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
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
        })

        it('the school status by default is active', async () => {
            expect(school.status).to.eq(Status.ACTIVE)
        })

        context('no permissions required', () => {
            it('should return the organization', async () => {
                const gqlOrganization = await getSchoolOrganization(
                    testClient,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlOrganization).to.exist
                expect(gqlOrganization).to.include({
                    organization_id: organizationId,
                })
            })
        })
    })

    describe('classes', () => {
        let organizationId: string
        let school: School
        let schoolId: string
        let classId: string

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
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
            classId = (await createClassAndValidate(testClient, organizationId))
                .class_id
            await addSchoolToClass(testClient, classId, schoolId, {
                authorization: getAdminAuthToken(),
            })
        })

        context('no permissions required', () => {
            it('should return all classes', async () => {
                const gqlClasses = await getSchoolClasses(
                    testClient,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlClasses).to.exist.with.lengthOf(1)
                expect(gqlClasses[0]).to.include({ class_id: classId })
            })
        })
    })

    describe('memberships', () => {
        let userId: string
        let organizationId: string
        let school: School
        let schoolId: string

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
        })

        context('no permissions required', () => {
            it('should return all memberships', async () => {
                const gqlMemberships = await getSchoolMembershipsViaSchool(
                    testClient,
                    schoolId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlMemberships).to.exist
                expect(gqlMemberships).to.have.lengthOf(1)
                expect(gqlMemberships[0]).to.include({
                    user_id: userId,
                    school_id: schoolId,
                })
            })
        })
    })

    describe('membership', () => {
        let userId: string
        let organizationId: string
        let school: School
        let schoolId: string

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
        })

        context('no permissions required', () => {
            it('should return the membership', async () => {
                const gqlMembership = await getSchoolMembershipViaSchool(
                    testClient,
                    schoolId,
                    userId,
                    { authorization: getNonAdminAuthToken() }
                )

                expect(gqlMembership).to.exist
                expect(gqlMembership).to.include({
                    user_id: userId,
                    school_id: schoolId,
                })
            })
        })
    })

    describe('set', () => {
        const originalSchoolName = 'Old School'
        const newSchoolName = 'New School'
        let userId: string
        let organizationId: string
        let school: School
        let schoolId: string
        let roleId: string

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
                originalSchoolName,
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
            roleId = (await createRole(testClient, organizationId, 'test_role'))
                .role_id
            await grantPermission(
                testClient,
                roleId,
                PermissionName.edit_school_20330,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when user has the edit school permission', () => {
            context('within the organization', () => {
                beforeEach(async () => {
                    await addRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        roleId
                    )
                })

                context(
                    'and the shortcode for the school has not been specified',
                    () => {
                        it('does not modify the original shortcode', async () => {
                            const gqlSchool = await updateSchool(
                                testClient,
                                schoolId,
                                originalSchoolName,
                                undefined,
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbSchool = await School.findOneOrFail({
                                where: { school_id: schoolId },
                            })
                            expect(gqlSchool).to.exist
                            expect(school.shortcode).not.to.be.undefined
                            expect(gqlSchool.shortcode).to.eq(school.shortcode)
                            expect(dbSchool).to.include(gqlSchool)
                        })
                    }
                )

                it('should return the modified school and update the database entry', async () => {
                    const gqlSchool = await updateSchool(
                        testClient,
                        schoolId,
                        newSchoolName,
                        'MYSHORT2',
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbSchool = await School.findOneOrFail({
                        where: { school_id: schoolId },
                    })
                    expect(gqlSchool).to.exist
                    expect(gqlSchool).to.include({
                        school_id: schoolId,
                        school_name: newSchoolName,
                        shortcode: 'MYSHORT2',
                    })
                    expect(dbSchool).to.include(gqlSchool)
                })

                it('should return the modified school and update the database entry ommiting the incorrect shortcode', async () => {
                    const gqlSchool = await updateSchool(
                        testClient,
                        schoolId,
                        newSchoolName,
                        'myverwrong3',
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbSchool = await School.findOneOrFail({
                        where: { school_id: schoolId },
                    })
                    expect(gqlSchool).to.exist
                    expect(gqlSchool).to.include({
                        school_id: schoolId,
                        school_name: newSchoolName,
                    })
                    expect(dbSchool).to.include(gqlSchool)
                    expect(gqlSchool.shortcode).to.not.equal('myverwrong3')
                })

                context('and the school is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteSchool(testClient, school.school_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('fails edit the school', async () => {
                        const gqlSchool = await updateSchool(
                            testClient,
                            schoolId,
                            newSchoolName,
                            undefined,
                            { authorization: getNonAdminAuthToken() }
                        )

                        const dbSchool = await School.findOneOrFail({
                            where: { school_id: schoolId },
                        })
                        expect(dbSchool.school_name).to.equal(
                            originalSchoolName
                        )
                        expect(gqlSchool).to.be.null
                    })
                })
            })

            context('within the school', () => {
                beforeEach(async () => {
                    await addRoleToSchoolMembership(
                        testClient,
                        userId,
                        schoolId,
                        roleId
                    )
                })

                it('should return the modified school and update the database entry', async () => {
                    const gqlSchool = await updateSchool(
                        testClient,
                        schoolId,
                        newSchoolName,
                        undefined,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbSchool = await School.findOneOrFail({
                        where: { school_id: schoolId },
                    })
                    expect(gqlSchool).to.exist
                    expect(gqlSchool).to.include({
                        school_id: schoolId,
                        school_name: newSchoolName,
                    })
                    expect(dbSchool).to.include(gqlSchool)
                })

                context('and the school is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteSchool(testClient, school.school_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('fails edit the school', async () => {
                        const gqlSchool = await updateSchool(
                            testClient,
                            schoolId,
                            newSchoolName,
                            undefined,
                            { authorization: getNonAdminAuthToken() }
                        )

                        const dbSchool = await School.findOneOrFail({
                            where: { school_id: schoolId },
                        })
                        expect(dbSchool.school_name).to.equal(
                            originalSchoolName
                        )
                        expect(gqlSchool).to.be.null
                    })
                })
            })
        })

        context('when user does not have the edit school permission', () => {
            it('should throw a permission exception, and not update the database entry', async () => {
                const fn = () =>
                    updateSchool(
                        testClient,
                        schoolId,
                        newSchoolName,
                        undefined,
                        { authorization: getNonAdminAuthToken() }
                    )
                await expect(fn()).to.be.rejected

                const dbSchool = await School.findOneOrFail({
                    where: { school_id: schoolId },
                })
                expect(dbSchool.school_name).to.equal(originalSchoolName)
            })
        })
    })

    describe('addUser', () => {
        let idOfUserToPerformAction: string
        let idOfUserToBeAdded: string
        let organizationId: string
        let school: School
        let schoolId: string
        let roleId: string
        const userToBeAdded = {
            email: 'testuser@gmail.com',
        } as User

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            idOfUserToPerformAction = (await createNonAdminUser(testClient))
                .user_id
            idOfUserToBeAdded = (
                await createUserAndValidate(testClient, userToBeAdded)
            ).user_id
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
                idOfUserToPerformAction,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            await addUserToSchool(
                testClient,
                idOfUserToPerformAction,
                schoolId,
                { authorization: getAdminAuthToken() }
            )
            roleId = (await createRole(testClient, organizationId, 'test_role'))
                .role_id
            await grantPermission(
                testClient,
                roleId,
                PermissionName.edit_school_20330,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when user has the edit school permission', () => {
            context('within the organization', () => {
                beforeEach(async () => {
                    await addRoleToOrganizationMembership(
                        testClient,
                        idOfUserToPerformAction,
                        organizationId,
                        roleId
                    )
                })

                it('should return the membership and create a database entry', async () => {
                    await addUserToOrganizationAndValidate(
                        testClient,
                        idOfUserToBeAdded,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                    const gqlMembership = await addUserToSchool(
                        testClient,
                        idOfUserToBeAdded,
                        schoolId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbMembership = await SchoolMembership.findOneOrFail({
                        where: {
                            user_id: idOfUserToBeAdded,
                            school_id: schoolId,
                        },
                    })
                    expect(gqlMembership).to.exist
                    expect(gqlMembership).to.include({
                        user_id: idOfUserToBeAdded,
                        school_id: schoolId,
                    })
                    expect(dbMembership).to.include(gqlMembership)
                })

                context(
                    "and the user being added isn't a member of the organization",
                    () => {
                        it('fails add user to the school', async () => {
                            const gqlMembership = await addUserToSchool(
                                testClient,
                                idOfUserToBeAdded,
                                schoolId,
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbMembership = await SchoolMembership.findOne(
                                {
                                    where: {
                                        user_id: idOfUserToBeAdded,
                                        school_id: schoolId,
                                    },
                                }
                            )
                            expect(dbMembership).to.be.undefined
                            expect(gqlMembership).to.be.null
                        })
                    }
                )

                context('and the school is marked as inactive', () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(
                            testClient,
                            idOfUserToBeAdded,
                            organizationId,
                            { authorization: getAdminAuthToken() }
                        )
                        await deleteSchool(testClient, school.school_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('fails add user to the school', async () => {
                        const gqlMembership = await addUserToSchool(
                            testClient,
                            idOfUserToBeAdded,
                            schoolId,
                            { authorization: getNonAdminAuthToken() }
                        )

                        const dbMembership = await SchoolMembership.findOne({
                            where: {
                                user_id: idOfUserToBeAdded,
                                school_id: schoolId,
                            },
                        })
                        expect(dbMembership).to.be.undefined
                        expect(gqlMembership).to.be.null
                    })
                })
            })

            context('within the school', () => {
                beforeEach(async () => {
                    await addRoleToSchoolMembership(
                        testClient,
                        idOfUserToPerformAction,
                        schoolId,
                        roleId
                    )
                })

                it('should return the membership and create a database entry', async () => {
                    await addUserToOrganizationAndValidate(
                        testClient,
                        idOfUserToBeAdded,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                    const gqlMembership = await addUserToSchool(
                        testClient,
                        idOfUserToBeAdded,
                        schoolId,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbMembership = await SchoolMembership.findOneOrFail({
                        where: {
                            user_id: idOfUserToBeAdded,
                            school_id: schoolId,
                        },
                    })
                    expect(gqlMembership).to.exist
                    expect(gqlMembership).to.include({
                        user_id: idOfUserToBeAdded,
                        school_id: schoolId,
                    })
                    expect(dbMembership).to.include(gqlMembership)
                })

                context(
                    "and the user being added isn't a member of the organization",
                    () => {
                        it('fails add user to the school', async () => {
                            const gqlMembership = await addUserToSchool(
                                testClient,
                                idOfUserToBeAdded,
                                schoolId,
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbMembership = await SchoolMembership.findOne(
                                {
                                    where: {
                                        user_id: idOfUserToBeAdded,
                                        school_id: schoolId,
                                    },
                                }
                            )
                            expect(dbMembership).to.be.undefined
                            expect(gqlMembership).to.be.null
                        })
                    }
                )

                context('and the school is marked as inactive', () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(
                            testClient,
                            idOfUserToBeAdded,
                            organizationId,
                            { authorization: getAdminAuthToken() }
                        )
                        await deleteSchool(testClient, school.school_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('fails add user to the school', async () => {
                        const gqlMembership = await addUserToSchool(
                            testClient,
                            idOfUserToBeAdded,
                            schoolId,
                            { authorization: getNonAdminAuthToken() }
                        )

                        const dbMembership = await SchoolMembership.findOne({
                            where: {
                                user_id: idOfUserToBeAdded,
                                school_id: schoolId,
                            },
                        })
                        expect(dbMembership).to.be.undefined
                        expect(gqlMembership).to.be.null
                    })
                })
            })
        })

        context('when user does not have the edit school permission', () => {
            it('should throw a permission exception, and not add a database entry', async () => {
                await addUserToOrganizationAndValidate(
                    testClient,
                    idOfUserToBeAdded,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )

                const fn = () =>
                    addUserToSchool(testClient, idOfUserToBeAdded, schoolId, {
                        authorization: getNonAdminAuthToken(),
                    })
                await expect(fn()).to.be.rejected

                const dbMembership = await SchoolMembership.findOne({
                    where: { user_id: idOfUserToBeAdded, school_id: schoolId },
                })
                expect(dbMembership).to.be.undefined
            })
        })
    })

    describe('delete', () => {
        let school: School
        let user: User
        let organization: Organization

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            school = await createSchool(
                testClient,
                organizationId,
                'school 1',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            const schoolId = school?.school_id
            const cls = await createClassAndValidate(testClient, organizationId)
            const classId = cls?.class_id
            await addSchoolToClass(testClient, classId, schoolId, {
                authorization: getAdminAuthToken(),
            })
        })

        context('when not authenticated', () => {
            it('should throw a permission exception, and not delete the database entry', async () => {
                const fn = () =>
                    deleteSchool(testClient, school.school_id, {
                        authorization: undefined,
                    })
                await expect(fn()).to.be.rejected

                const dbSchool = await School.findOneOrFail(school.school_id)
                expect(dbSchool.status).to.eq(Status.ACTIVE)
                expect(dbSchool.deleted_at).to.be.null
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete class permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    it('should throw a permission exception, and not delete the database entry', async () => {
                        const fn = () =>
                            deleteSchool(testClient, school.school_id, {
                                authorization: getNonAdminAuthToken(),
                            })
                        await expect(fn()).to.be.rejected

                        const dbSchool = await School.findOneOrFail(
                            school.school_id
                        )
                        expect(dbSchool.status).to.eq(Status.ACTIVE)
                        expect(dbSchool.deleted_at).to.be.null
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.delete_school_20440,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('deletes the school', async () => {
                    const gqlSchool = await deleteSchool(
                        testClient,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool).to.be.true
                    const dbSchool = await School.findOneOrFail(
                        school.school_id
                    )
                    expect(dbSchool.status).to.eq(Status.INACTIVE)
                    expect(dbSchool.deleted_at).not.to.be.null
                })

                it('deletes the school memberships', async () => {
                    const gqlSchool = await deleteSchool(
                        testClient,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool).to.be.true
                    const dbSchool = await School.findOneOrFail(
                        school.school_id
                    )
                    const dbSchoolMemberships = await SchoolMembership.find({
                        where: { school_id: school.school_id },
                    })
                    expect(dbSchoolMemberships).to.satisfy(
                        (memberships: SchoolMembership[]) => {
                            return memberships.every(
                                (membership) =>
                                    membership.status === Status.INACTIVE
                            )
                        }
                    )
                })

                it('deletes the school classes', async () => {
                    const gqlSchool = await deleteSchool(
                        testClient,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlSchool).to.be.true
                    const dbSchool = await School.findOneOrFail(
                        school.school_id
                    )
                    const dbClasses = (await dbSchool.classes) || []

                    expect(dbClasses).to.satisfy((classes: Class[]) => {
                        return classes.every(
                            (cls) => cls.status === Status.INACTIVE
                        )
                    })
                })

                context('and the school is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteSchool(testClient, school.school_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('fails to delete the school', async () => {
                        const gqlSchool = await deleteSchool(
                            testClient,
                            school.school_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSchool).to.be.null
                        const dbSchool = await School.findOneOrFail(
                            school.school_id
                        )
                        expect(dbSchool.status).to.eq(Status.INACTIVE)
                        expect(dbSchool.deleted_at).not.to.be.null
                    })
                })
            })
        })
    })

    describe('programs', () => {
        let user: User
        let organization: Organization
        let school: School
        let program: Program

        const programInfo = (program: any) => {
            return {
                id: program.id,
                name: program.name,
                system: program.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            school = await createSchool(
                testClient,
                organization.organization_id,
                'school 1',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            const schoolId = school?.school_id
            program = createProgram(organization)
            await program.save()
            await editPrograms(testClient, school.school_id, [program.id], {
                authorization: getAdminAuthToken(),
            })
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            it('fails to list programs in the school', async () => {
                const fn = () =>
                    listPrograms(testClient, school.school_id, {
                        authorization: undefined,
                    })

                await expect(fn()).to.be.rejected
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view class permissions', () => {
                it('fails to list programs in the school', async () => {
                    const fn = () =>
                        listPrograms(testClient, school.school_id, {
                            authorization: getNonAdminAuthToken(),
                        })

                    await expect(fn()).to.be.rejected
                })
            })

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    const role = await createRole(
                        testClient,
                        organization.organization_id
                    )
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.view_school_20110,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the programs in the school', async () => {
                    const gqlPrograms = await listPrograms(
                        testClient,
                        school.school_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    expect(gqlPrograms).not.to.be.empty
                    expect(gqlPrograms.map(programInfo)).to.deep.eq([
                        programInfo(program),
                    ])
                })
            })
        })
    })

    describe('editPrograms', () => {
        let organization: Organization
        let school: School
        let program: Program
        let organizationId: string
        let otherUserId: string

        const programInfo = (program: any) => {
            return program.id
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)

            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            organizationId = organization.organization_id
            school = await createSchool(
                testClient,
                organization.organization_id,
                'school 1',
                undefined,
                { authorization: getAdminAuthToken() }
            )

            const otherUser = await createNonAdminUser(testClient)
            otherUserId = otherUser.user_id
            await addUserToOrganizationAndValidate(
                testClient,
                otherUserId,
                organizationId,
                { authorization: getAdminAuthToken() }
            )

            program = createProgram(organization)
            await program.save()
        })

        context('when not authenticated', () => {
            it('throws a permission error', async () => {
                const fn = () =>
                    editPrograms(testClient, school.school_id, [program.id], {
                        authorization: undefined,
                    })
                await expect(fn()).to.be.rejected

                const dbPrograms = (await school.programs) || []
                expect(dbPrograms).to.be.empty
            })
        })

        context('when authenticated', () => {
            let role: any

            beforeEach(async () => {
                role = await createRole(testClient, organizationId)
                await addRoleToOrganizationMembership(
                    testClient,
                    otherUserId,
                    organizationId,
                    role.role_id
                )
            })

            context(
                'and the user does not have edit school permissions',
                () => {
                    it('throws a permission error', async () => {
                        const fn = () =>
                            editPrograms(
                                testClient,
                                school.school_id,
                                [program.id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        await expect(fn()).to.be.rejected

                        const dbPrograms = (await school.programs) || []
                        expect(dbPrograms).to.be.empty
                    })
                }
            )

            context('and the user has all the permissions', () => {
                beforeEach(async () => {
                    await grantPermission(
                        testClient,
                        role.role_id,
                        PermissionName.edit_school_20330,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('edits the school programs', async () => {
                    let dbSchool = await School.findOneOrFail(school.school_id)
                    let dbPrograms = (await dbSchool.programs) || []
                    expect(dbPrograms).to.be.empty

                    let gqlPrograms = await editPrograms(
                        testClient,
                        school.school_id,
                        [program.id],
                        { authorization: getNonAdminAuthToken() }
                    )

                    dbSchool = await School.findOneOrFail(school.school_id)
                    dbPrograms = (await dbSchool.programs) || []
                    expect(dbPrograms).not.to.be.empty
                    expect(dbPrograms.map(programInfo)).to.deep.eq(
                        gqlPrograms.map(programInfo)
                    )

                    gqlPrograms = await editPrograms(
                        testClient,
                        school.school_id,
                        [],
                        { authorization: getNonAdminAuthToken() }
                    )
                    dbSchool = await School.findOneOrFail(school.school_id)
                    dbPrograms = (await dbSchool.programs) || []
                    expect(dbPrograms).to.be.empty
                })

                context('and the school is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteSchool(testClient, school.school_id, {
                            authorization: getAdminAuthToken(),
                        })
                    })

                    it('does not edit the school programs', async () => {
                        const gqlPrograms = await editPrograms(
                            testClient,
                            school.school_id,
                            [program.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlPrograms).to.be.null

                        const dbPrograms = (await school.programs) || []
                        expect(dbPrograms).to.be.empty
                    })
                })
            })
        })
    })
})
