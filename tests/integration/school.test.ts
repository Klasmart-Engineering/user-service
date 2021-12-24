import { expect, use } from 'chai'
import { Connection, getManager } from 'typeorm'
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
    buildDeleteSchoolInputArray,
} from '../utils/operations/schoolOps'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../utils/operations/userOps'
import { createTestConnection, TestConnection } from '../utils/testConnection'
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
import {
    AddClassesToSchoolInput,
    CreateSchoolInput,
    DeleteSchoolInput,
    SchoolsMutationResult,
    UpdateSchoolInput,
} from '../../src/types/graphQL/school'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { mutate } from '../../src/utils/mutations/commonStructure'
import {
    AddClassesToSchools,
    CreateSchools,
    DeleteSchools,
    UpdateSchools,
} from '../../src/resolvers/school'
import { buildPermissionError, permErrorMeta } from '../utils/errors'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import {
    createUser,
    createAdminUser as createAdmin,
} from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { formatShortCode, generateShortCode } from '../../src/utils/shortcode'
import { APIErrorCollection } from '../../src/types/errors/apiError'
import { compareErrors, expectAPIError } from '../utils/apiError'
import {
    createEntityAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../../src/utils/resolvers'
import faker from 'faker'
import { NIL_UUID } from '../utils/database'
import { createMultipleSchools } from '../factories/school.factory'
import { createClasses } from '../factories/class.factory'
import { createRole as roleFactory } from '../factories/role.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'

use(chaiAsPromised)

const expectAPIErrorCollection = async (
    resolverCall: Promise<any>,
    expectedErrors: APIErrorCollection
) => {
    const { errors } = (await expect(resolverCall).to.be
        .rejected) as APIErrorCollection
    expect(errors).to.exist
    for (let x = 0; x < errors.length; x++)
        compareErrors(errors[x], expectedErrors.errors[x])
}

describe('school', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    let school: School
    let school2: School
    let user: User
    let userWithPermission: User
    let userWithoutPermission: User
    let admin: User
    let organization: Organization
    let organization2: Organization
    let shortCode: string

    const orgUsersAndPermissions = async () => {
        const orgOwner = await createAdminUser(testClient)
        user = await createNonAdminUser(testClient)
        organization = await createOrganization(orgOwner).save()
        await addUserToOrganizationAndValidate(
            testClient,
            user.user_id,
            organization.organization_id,
            { authorization: getAdminAuthToken() }
        )
        organization2 = await createOrganization().save()

        const role = await createRole(testClient, organization.organization_id)
        await grantPermission(
            testClient,
            role.role_id,
            PermissionName.delete_school_20440,
            { authorization: getAdminAuthToken() }
        )
        const roleCreate = await createRole(
            testClient,
            organization.organization_id
        )
        await grantPermission(
            testClient,
            roleCreate.role_id,
            PermissionName.create_school_20220,
            { authorization: getAdminAuthToken() }
        )
        const editRole = await createRole(
            testClient,
            organization.organization_id
        )
        await grantPermission(
            testClient,
            editRole.role_id,
            PermissionName.edit_school_20330,
            { authorization: getAdminAuthToken() }
        )

        admin = await createAdmin().save()
        userWithPermission = await createUser().save()
        userWithoutPermission = await createUser().save()
        await createOrganizationMembership({
            user: userWithoutPermission,
            organization: organization,
        }).save()
        await createOrganizationMembership({
            user: userWithPermission,
            organization,
            roles: [role, roleCreate, editRole],
        }).save()
    }

    const createInitialSchools = async () => {
        await orgUsersAndPermissions()
        shortCode = generateShortCode()
        school = await createSchool(
            testClient,
            organization?.organization_id,
            faker.random.word(),
            shortCode,
            { authorization: getAdminAuthToken() }
        )
        const schoolId = school?.school_id
        const cls = await createClassAndValidate(
            testClient,
            organization?.organization_id
        )
        const classId = cls?.class_id
        await addSchoolToClass(testClient, classId, schoolId, {
            authorization: getAdminAuthToken(),
        })

        school2 = await createSchool(
            testClient,
            organization2.organization_id,
            faker.random.word(),
            undefined,
            { authorization: getAdminAuthToken() }
        )
    }

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
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
                await expect(
                    updateSchool(
                        testClient,
                        schoolId,
                        newSchoolName,
                        undefined,
                        { authorization: getNonAdminAuthToken() }
                    )
                ).to.be.rejected

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

                await expect(
                    addUserToSchool(testClient, idOfUserToBeAdded, schoolId, {
                        authorization: getNonAdminAuthToken(),
                    })
                ).to.be.rejected

                const dbMembership = await SchoolMembership.findOne({
                    where: { user_id: idOfUserToBeAdded, school_id: schoolId },
                })
                expect(dbMembership).to.be.undefined
            })
        })
    })

    describe('delete', () => {
        beforeEach(async () => {
            await createInitialSchools()
        })

        context('when not authenticated', () => {
            it('should throw a permission exception, and not delete the database entry', async () => {
                await expect(
                    deleteSchool(testClient, school.school_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected

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
                        await expect(
                            deleteSchool(testClient, school.school_id, {
                                authorization: getNonAdminAuthToken(),
                            })
                        ).to.be.rejected

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
                await expect(
                    listPrograms(testClient, school.school_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected
            })
        })

        context('when authenticated', () => {
            // skipped temporarily because authorization check is not currently in place/was removed
            // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
            context.skip(
                'and the user does not have view class permissions',
                () => {
                    it('fails to list programs in the school', async () => {
                        await expect(
                            listPrograms(testClient, school.school_id, {
                                authorization: getNonAdminAuthToken(),
                            })
                        ).to.be.rejected
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
                await expect(
                    editPrograms(testClient, school.school_id, [program.id], {
                        authorization: undefined,
                    })
                ).to.be.rejected

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
                        await expect(
                            editPrograms(
                                testClient,
                                school.school_id,
                                [program.id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

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

    context('deleteSchools', () => {
        const schoolsCount = 2
        const deleteSchoolsFromResolver = async (
            user: User,
            input: DeleteSchoolInput[]
        ): Promise<SchoolsMutationResult> => {
            const permissions = new UserPermissions(userToPayload(user))
            const ctx = { permissions }
            return mutate(DeleteSchools, { input }, ctx)
        }

        const expectSchoolsDeleted = async (
            user: User,
            schoolsToDelete: School[]
        ) => {
            const input = buildDeleteSchoolInputArray(schoolsToDelete)
            const { schools } = await deleteSchoolsFromResolver(user, input)

            expect(schools).to.have.lengthOf(input.length)
            schools.forEach((c, i) => {
                expect(c.id).to.eq(input[i].id)
                expect(c.status).to.eq(Status.INACTIVE)
            })

            const schoolsDB = await School.findByIds(input.map((i) => i.id))

            expect(schoolsDB).to.have.lengthOf(input.length)
            schoolsDB.forEach((cdb) => {
                const inputRelated = input.find((i) => i.id === cdb.school_id)
                expect(inputRelated).to.exist
                expect(cdb.school_id).to.eq(inputRelated?.id)
                expect(cdb.status).to.eq(Status.INACTIVE)
            })
        }

        const expectSchools = async (quantity: number) => {
            const schools = await School.count({
                where: { status: Status.ACTIVE },
            })

            expect(schools).to.eq(quantity)
        }

        beforeEach(async () => {
            await createInitialSchools()
        })

        context('when user is admin', () => {
            it('should delete any school', async () => {
                const schoolsToDelete = [school, school2]

                await expectSchoolsDeleted(admin, schoolsToDelete)
                await expectSchools(0)
            })
        })

        context('when user is not admin', () => {
            let user: User
            const permError = permErrorMeta(PermissionName.delete_school_20440)

            context('and has permission', () => {
                it('should delete schools in its organization', async () => {
                    const schoolsToDelete = [school]
                    await expectSchoolsDeleted(
                        userWithPermission,
                        schoolsToDelete
                    )

                    expect(schoolsCount - schoolsToDelete.length)
                })
            })

            context('and does not have permissions', () => {
                user = userWithoutPermission
                context('and has membership', () => {
                    beforeEach(() => {
                        user = userWithoutPermission
                    })

                    it('throws a permission error', async () => {
                        const schoolsToDelete = [school]
                        const input = buildDeleteSchoolInputArray(
                            schoolsToDelete
                        )

                        const operation = deleteSchoolsFromResolver(user, input)

                        await expect(operation).to.be.rejectedWith(
                            permError(user, [organization])
                        )

                        await expectSchools(schoolsCount)
                    })
                })
            })
        })
    })

    context('updateSchools', () => {
        const schoolsCount = 2
        let input: UpdateSchoolInput[]

        const updateSchoolsFromResolver = async (
            user: User,
            input: UpdateSchoolInput[]
        ): Promise<SchoolsMutationResult> => {
            const permissions = new UserPermissions(userToPayload(user))
            const ctx = { permissions }
            return mutate(UpdateSchools, { input }, ctx)
        }

        const expectSchoolsUpdated = async (
            user: User,
            input: UpdateSchoolInput[]
        ) => {
            const { schools } = await updateSchoolsFromResolver(user, input)
            expect(schools).to.have.lengthOf(input.length)
            schools.forEach((c, i) => {
                expect(c.id).to.eq(input[i].id)
                expect(c.name).to.eq(input[i].name)
                expect(c.shortCode).to.eq(
                    formatShortCode(input[i].shortCode) || c.shortCode
                )
            })

            const schoolsDB = await School.findByIds(input.map((i) => i.id))

            expect(schoolsDB).to.have.lengthOf(input.length)
            schoolsDB.forEach((cdb) => {
                const inputRelated = input.find((i) => i.id === cdb.school_id)
                expect(inputRelated).to.exist
                expect(cdb.school_id).to.eq(inputRelated?.id)
            })
        }

        const expectSchools = async (quantity: number) => {
            const schools = await School.count({
                where: { status: Status.ACTIVE },
            })

            expect(schools).to.eq(quantity)
        }

        beforeEach(async () => {
            await createInitialSchools()
            input = [
                {
                    id: school.school_id,
                    name: school.school_name,
                    shortCode: ``,
                    organizationId: organization.organization_id,
                },
                {
                    id: school2.school_id,
                    name: school2.school_name,
                    shortCode: ``,
                    organizationId: (await school2.organization)
                        ?.organization_id as string,
                },
            ]
        })

        context('when user is admin', () => {
            it('should update any school', async () => {
                await expectSchoolsUpdated(admin, input)
                await expectSchools(schoolsCount)
            })
        })

        context('when user is not admin', () => {
            const permError = permErrorMeta(PermissionName.edit_school_20330)

            it('should update schools if the caller has organization membership', async () => {
                await expectSchoolsUpdated(userWithPermission, [input[0]])
            })

            it('when caller does not have permissions to update schools for all organizations', async () => {
                const operation = expectSchoolsUpdated(
                    userWithPermission,
                    input
                )

                await expect(operation).to.be.rejectedWith(
                    permError(userWithPermission, [organization2])
                )
            })
        })
        context('custom validation', () => {
            let newSchool: School
            context(
                'when it exists a school with the same name or the same shortcode for the organization',
                () => {
                    beforeEach(async () => {
                        await createInitialSchools()
                        newSchool = await createSchool(
                            testClient,
                            organization?.organization_id,
                            faker.random.word(),
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('should throw an ErrorCollection when a record with the same name exists', async () => {
                        input = [
                            {
                                id: school.school_id,
                                name: newSchool.school_name,
                                shortCode: ``,
                                organizationId: organization.organization_id,
                            },
                        ]
                        await expectAPIErrorCollection(
                            updateSchoolsFromResolver(admin, input),
                            new APIErrorCollection([
                                createEntityAPIError(
                                    'duplicateChild',
                                    0,
                                    'School',
                                    newSchool.school_name,
                                    'Organization',
                                    organization.organization_id,
                                    ['organizationId', 'name']
                                ),
                            ])
                        )
                    })

                    it('should throw an ErrorCollection when a record with the same shortcode exists', async () => {
                        input = [
                            {
                                id: newSchool.school_id,
                                name: faker.random.word(),
                                shortCode: shortCode,
                                organizationId: organization.organization_id,
                            },
                        ]
                        await expectAPIErrorCollection(
                            updateSchoolsFromResolver(admin, input),
                            new APIErrorCollection([
                                createEntityAPIError(
                                    'duplicateChild',
                                    0,
                                    'School',
                                    shortCode,
                                    'Organization',
                                    organization.organization_id,
                                    ['organizationId', 'shortCode']
                                ),
                            ])
                        )
                    })
                }
            )
        })
    })

    context('CreateSchools', () => {
        let input: CreateSchoolInput[]
        const createSchoolsFromResolver = async (
            user: User,
            input: CreateSchoolInput[]
        ): Promise<SchoolsMutationResult> => {
            const permissions = new UserPermissions(userToPayload(user))
            const ctx = { permissions }
            return mutate(CreateSchools, { input }, ctx)
        }

        const expectSchoolsCreated = async (
            user: User,
            input: CreateSchoolInput[]
        ) => {
            const { schools } = await createSchoolsFromResolver(user, input)

            expect(schools).to.have.lengthOf(input.length)
            schools.forEach((c, i) => {
                expect(c.name).to.eq(input[i].name)
                expect(c.status).to.eq(Status.ACTIVE)
            })

            const schoolsDB = await School.find()

            expect(schoolsDB).to.have.lengthOf(input.length)
            schoolsDB.forEach((cdb) => {
                const inputRelated = input.find(
                    (i) => i.name === cdb.school_name
                )
                expect(inputRelated).to.exist
                expect(cdb.school_name).to.eq(inputRelated?.name)
                expect(cdb.status).to.eq(Status.ACTIVE)
            })
        }

        const expectSchools = async (quantity: number) => {
            const schools = await School.count({
                where: { status: Status.ACTIVE },
            })

            expect(schools).to.eq(quantity)
        }

        beforeEach(async () => {
            await orgUsersAndPermissions()
            input = [
                {
                    organizationId: organization.organization_id,
                    name: 'test',
                },
                {
                    organizationId: organization2.organization_id,
                    name: 'test2',
                },
            ]
        })

        context('when user is admin', () => {
            it('should create any school', async () => {
                await expectSchoolsCreated(admin, input)
                await expectSchools(2)
            })
        })

        context('when user is not admin', () => {
            const permError = permErrorMeta(PermissionName.create_school_20220)

            it('should create schools if the caller has organization membership', async () => {
                await expectSchoolsCreated(userWithPermission, [
                    {
                        organizationId: organization.organization_id,
                        name: 'test',
                    },
                ])

                await expectSchools(1)
            })

            it('when caller does not have permissions to create schools for all organizations', async () => {
                const operation = expectSchoolsCreated(
                    userWithPermission,
                    input
                )

                await expect(operation).to.be.rejectedWith(
                    permError(userWithPermission, [organization2])
                )
                await expectSchools(0)
            })
        })

        context('custom validation', () => {
            context(
                "when an organization with the received 'organizationId' does not exists",
                () => {
                    it('should throw an ErrorCollection', async () => {
                        input = [
                            {
                                organizationId: NIL_UUID,
                                name: 'test',
                            },
                        ]

                        await expectAPIErrorCollection(
                            createSchoolsFromResolver(admin, input),
                            new APIErrorCollection([
                                createNonExistentOrInactiveEntityAPIError(
                                    0,
                                    ['organization_id'],
                                    'ID',
                                    'Organization',
                                    NIL_UUID
                                ),
                            ])
                        )

                        await expectSchools(0)
                    })
                }
            )

            context(
                'when it exists a school with the same name or the same shortcode for the organization',
                () => {
                    beforeEach(async () => {
                        await createInitialSchools()
                    })

                    it('should throw an ErrorCollection when a record with the same name exists', async () => {
                        input = [
                            {
                                organizationId: organization.organization_id,
                                name: school.school_name,
                            },
                        ]
                        await expectAPIErrorCollection(
                            createSchoolsFromResolver(admin, input),
                            new APIErrorCollection([
                                createEntityAPIError(
                                    'duplicateChild',
                                    0,
                                    'School',
                                    school.school_name,
                                    'Organization',
                                    organization.organization_id,
                                    ['organizationId', 'name']
                                ),
                            ])
                        )

                        await expectSchools(2)
                    })

                    it('should throw an ErrorCollection when a record with the same shortcode exists', async () => {
                        input = [
                            {
                                organizationId: organization.organization_id,
                                name: faker.random.word(),
                                shortCode: shortCode,
                            },
                        ]
                        await expectAPIErrorCollection(
                            createSchoolsFromResolver(admin, input),
                            new APIErrorCollection([
                                createEntityAPIError(
                                    'duplicateChild',
                                    0,
                                    'School',
                                    shortCode,
                                    'Organization',
                                    organization.organization_id,
                                    ['organizationId', 'shortCode']
                                ),
                            ])
                        )

                        await expectSchools(2)
                    })
                }
            )
        })
    })

    describe('AddClassesToSchools', () => {
        let adminUser: User
        let nonAdminUser: User
        let organization: Organization
        let schools: School[]
        let classes: Class[]
        let input: AddClassesToSchoolInput[]

        function addClasses(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            const ctx = { permissions }
            return mutate(AddClassesToSchools, { input }, ctx)
        }

        async function checkOutput() {
            for (const schoolInputs of input) {
                const { schoolId, classIds } = schoolInputs

                const school = await School.findOne(schoolId)
                const dbClasses = await school?.classes

                const dbClassIds = new Set(
                    dbClasses?.map((val) => val.class_id)
                )
                const classIdsSet = new Set(classIds)

                expect(dbClassIds.size).to.equal(classIdsSet.size)
                dbClassIds.forEach(
                    (val) => expect(classIdsSet.has(val)).to.be.true
                )
            }
        }

        function checkNotFoundErrors(
            actualError: Error,
            expectedErrors: {
                entity: string
                id: string
                entryIndex: number
            }[]
        ) {
            expectedErrors.forEach((val, errorIndex) => {
                expectAPIError.nonexistent_entity(
                    actualError,
                    {
                        entity: val.entity,
                        entityName: val.id,
                        index: val.entryIndex,
                    },
                    ['id'],
                    errorIndex,
                    expectedErrors.length
                )
            })
        }

        async function checkNoChangesMade(useAdminUser = true) {
            it('does not add the classes', async () => {
                await expect(
                    addClasses(useAdminUser ? adminUser : nonAdminUser)
                ).to.be.rejected
                const insertedClasses: Class[] = []
                for (const school of schools) {
                    const insertedClasses = await school.classes
                    if (insertedClasses) classes.push(...insertedClasses)
                }
                expect(insertedClasses).to.have.lengthOf(0)
            })
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            organization = await createOrganization().save()
            schools = createMultipleSchools(3)
            classes = createClasses(3, organization)
            await connection.manager.save([...schools, ...classes])
            input = [
                {
                    schoolId: schools[0].school_id,
                    classIds: [classes[0].class_id],
                },
                {
                    schoolId: schools[1].school_id,
                    classIds: [classes[1].class_id, classes[2].class_id],
                },
                {
                    schoolId: schools[2].school_id,
                    classIds: [classes[0].class_id, classes[2].class_id],
                },
            ]
        })

        context('when caller has permissions to add classes to schools', () => {
            context('and all attributes are valid', () => {
                it('adds all the classes', async () => {
                    await expect(addClasses()).to.be.fulfilled
                    await checkOutput()
                })
            })

            context('and one of the classes was already added', () => {
                beforeEach(async () => {
                    schools[0].classes = Promise.resolve([classes[0]])
                    await schools[0].save()
                })

                it('returns a duplicate user error', async () => {
                    const res = await expect(addClasses()).to.be.rejected
                    expectAPIError.duplicate_child_entity(
                        res,
                        {
                            entity: 'Class',
                            entityName: classes[0].class_name || '',
                            parentEntity: 'School',
                            parentName: schools[0].school_name || '',
                            index: 0,
                        },
                        [''],
                        0,
                        1
                    )
                })
            })

            context('and one of the schools is inactive', async () => {
                beforeEach(
                    async () => await schools[2].inactivate(getManager())
                )

                it('returns an nonexistent school error', async () => {
                    const res = await expect(addClasses()).to.be.rejected
                    checkNotFoundErrors(res, [
                        {
                            entity: 'School',
                            id: schools[2].school_id,
                            entryIndex: 2,
                        },
                    ])
                })

                await checkNoChangesMade()
            })

            context('and one of the classes is inactive', async () => {
                beforeEach(
                    async () => await classes[1].inactivate(getManager())
                )

                it('returns an nonexistent class error', async () => {
                    const res = await expect(addClasses()).to.be.rejected
                    checkNotFoundErrors(res, [
                        {
                            entity: 'Class',
                            id: classes[1].class_id,
                            entryIndex: 1,
                        },
                    ])
                })

                await checkNoChangesMade()
            })

            context('and one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        schools[2].inactivate(getManager()),
                        classes[1].inactivate(getManager()),
                    ])
                })

                it('returns several nonexistent errors', async () => {
                    const res = await expect(addClasses()).to.be.rejected
                    checkNotFoundErrors(res, [
                        {
                            entity: 'Class',
                            id: classes[1].class_id,
                            entryIndex: 1,
                        },
                        {
                            entity: 'School',
                            id: schools[2].school_id,
                            entryIndex: 2,
                        },
                    ])
                })

                await checkNoChangesMade()
            })

            context('when adding 1 class then 20 classes', () => {
                it('makes the same number of database calls', async () => {
                    const twentyClasses = createClasses(20, organization)
                    connection.logger.reset()
                    input = [
                        {
                            schoolId: schools[0].school_id,
                            classIds: [classes[0].class_id],
                        },
                    ]
                    await expect(addClasses()).to.be.fulfilled
                    const baseCount = connection.logger.count
                    await connection.manager.save([...twentyClasses])
                    input = [
                        {
                            schoolId: schools[0].school_id,
                            classIds: twentyClasses.map((c) => c.class_id),
                        },
                    ]
                    connection.logger.reset()
                    await expect(addClasses()).to.be.fulfilled
                    expect(connection.logger.count).to.equal(baseCount)
                })
            })
        })

        context(
            'when caller does not have permissions to add classes to all schools',
            async () => {
                beforeEach(async () => {
                    const nonAdminRole = await roleFactory(
                        'Non Admin Role',
                        organization,
                        {
                            permissions: [PermissionName.edit_school_20330],
                        }
                    ).save()
                    await createOrganizationMembership({
                        user: nonAdminUser,
                        organization: organization,
                        roles: [nonAdminRole],
                    }).save()
                    await createSchoolMembership({
                        user: nonAdminUser,
                        school: schools[0],
                        roles: [nonAdminRole],
                    }).save()
                })

                it('returns a permission error', async () => {
                    const sc = [schools[1], schools[2]]
                    const errorMessage = buildPermissionError(
                        PermissionName.edit_school_20330,
                        nonAdminUser,
                        undefined,
                        sc
                    )
                    await expect(addClasses(nonAdminUser)).to.be.rejectedWith(
                        errorMessage
                    )
                })

                await checkNoChangesMade(false)
            }
        )
    })
})
