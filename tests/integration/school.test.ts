import { expect, use } from 'chai'
import { getManager, In, getConnection } from 'typeorm'
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
import { TestConnection } from '../utils/testConnection'
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
import { User } from '../../src/entities/user'
import { Status } from '../../src/entities/status'
import { addSchoolToClass } from '../utils/operations/classOps'
import { createUserAndValidate } from '../utils/operations/modelOps'
import { createProgram, createPrograms } from '../factories/program.factory'
import chaiAsPromised from 'chai-as-promised'
import {
    AddClassesToSchoolInput,
    AddProgramsToSchoolInput,
    CreateSchoolInput,
    DeleteSchoolInput,
    SchoolsMutationResult,
    UpdateSchoolInput,
    RemoveProgramsFromSchoolInput,
    AddUsersToSchoolInput,
    RemoveClassesFromSchoolInput,
} from '../../src/types/graphQL/school'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { mutate } from '../../src/utils/mutations/commonStructure'
import {
    RemoveUsersFromSchools,
    AddClassesToSchools,
    AddProgramsToSchools,
    CreateSchools,
    DeleteSchools,
    UpdateSchools,
    RemoveProgramsFromSchools,
    AddUsersToSchools,
    RemoveClassesFromSchools,
    ChangeSchoolMembershipStatus,
    ChangeSchoolMembershipStatusEntityMap,
    ReactivateUsersFromSchools,
    DeleteUsersFromSchools,
} from '../../src/resolvers/school'
import { buildPermissionError, permErrorMeta } from '../utils/errors'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import {
    createUser,
    createAdminUser as createAdmin,
    createUsers,
} from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { formatShortCode, generateShortCode } from '../../src/utils/shortcode'
import faker from 'faker'
import { createSchools } from '../factories/school.factory'
import {
    createClasses,
    createClass as createFactoryClass,
} from '../factories/class.factory'
import {
    createRole as roleFactory,
    createRoles,
} from '../factories/role.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createSchool as createASchool } from '../factories/school.factory'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import {
    checkNotFoundErrors,
    compareErrors,
    compareMultipleErrors,
    expectAPIError,
} from '../utils/apiError'
import { APIError, APIErrorCollection } from '../../src/types/errors/apiError'
import {
    createDuplicateAttributeAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
    createNonExistentOrInactiveEntityAPIError,
} from '../../src/utils/resolvers/errors'
import { NIL_UUID } from '../utils/database'
import { Role } from '../../src/entities/role'
import { v4 as uuid_v4 } from 'uuid'
import { ObjMap } from '../../src/utils/stringUtils'

use(deepEqualInAnyOrder)
use(chaiAsPromised)

interface OrgData {
    org: Organization
    admin: User
    schools: School[]
    schoolMembers: User[]
}

interface SchoolData {
    school: School
    members: User[]
}

interface SpecialAdminData {
    admin: User
    schoolMembershipsData: SchoolData[]
    orgMembershipsData?: OrgData[]
}

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

function intersection<T>(setA: Set<T>, setB: Set<T>) {
    const _intersection = new Set<T>()
    for (const elem of setB) {
        if (setA.has(elem)) {
            _intersection.add(elem)
        }
    }
    return _intersection
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
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
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
                    expect(dbPrograms.map(programInfo)).to.deep.equalInAnyOrder(
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
            return mutate(DeleteSchools, { input }, permissions)
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
            return mutate(UpdateSchools, { input }, permissions)
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
                                    'existentChild',
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
                                    'existentChild',
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
            return mutate(CreateSchools, { input }, permissions)
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

            context('but is school admin', () => {
                let schoolAdmin: User

                beforeEach(async () => {
                    schoolAdmin = await createUser().save()
                    const schoolAdminRole = await Role.findOneOrFail({
                        where: { role_name: 'School Admin', system_role: true },
                    })

                    await createOrganizationMembership({
                        user: schoolAdmin,
                        organization,
                        roles: [schoolAdminRole],
                    })

                    input = [
                        {
                            organizationId: organization.organization_id,
                            name: 'test',
                        },
                    ]
                })

                it('should not create schools', async () => {
                    const operation = expectSchoolsCreated(schoolAdmin, input)
                    await expect(operation).to.be.rejectedWith(
                        permError(schoolAdmin, [organization])
                    )

                    await expectSchools(0)
                })
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
                                    'existentChild',
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
                                    'existentChild',
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
            return mutate(AddClassesToSchools, { input }, permissions)
        }

        async function checkClassesAddedToSchools() {
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

        async function checkNoChangesMade(useAdminUser = true) {
            it('does not add the classes', async () => {
                await expect(
                    addClasses(useAdminUser ? adminUser : nonAdminUser)
                ).to.be.rejected
                const promises = schools.reduce(
                    (acc: Promise<Class[]>[], current) => {
                        if (current.classes) acc.push(current.classes)
                        return acc
                    },
                    []
                )
                const insertedClasses = (await Promise.all(promises)).flat()
                expect(insertedClasses).to.have.lengthOf(0)
            })
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            organization = await createOrganization().save()
            schools = createSchools(3, organization)
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
                    await checkClassesAddedToSchools()
                })
            })

            context('and one of the classes was already added', () => {
                beforeEach(async () => {
                    schools[0].classes = Promise.resolve([classes[0]])
                    await schools[0].save()
                })

                it('returns a duplicate user error', async () => {
                    const res = await expect(addClasses()).to.be.rejected
                    expectAPIError.existent_child_entity(
                        res,
                        {
                            entity: 'Class',
                            entityName: classes[0].class_id,
                            parentEntity: 'School',
                            parentName: schools[0].school_id,
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
            })

            context(
                'and one of the classes is belongs to the wrong organization',
                async () => {
                    let otherClass: Class
                    beforeEach(async () => {
                        const otherOrganization = await createOrganization().save()
                        otherClass = await createFactoryClass(
                            undefined,
                            otherOrganization
                        ).save()
                        input[0].classIds.push(otherClass.class_id)
                    })

                    it('returns a unauthorized error', async () => {
                        await expectAPIErrorCollection(
                            addClasses(),
                            new APIErrorCollection([
                                new APIError({
                                    code: 'UNAUTHORIZED',
                                    message:
                                        'You are unauthorized to perform this action.',
                                    variables: ['id'],
                                    entity: 'Class',
                                    entityName: 'Class',
                                    attribute: 'ID',
                                    otherAttribute: otherClass.class_id,
                                    index: 0,
                                }),
                            ])
                        )
                    })
                }
            )

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
                            entity: 'School',
                            id: schools[2].school_id,
                            entryIndex: 2,
                        },
                        {
                            entity: 'Class',
                            id: classes[1].class_id,
                            entryIndex: 1,
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
                        roles: [],
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
                        [organization],
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

    describe('ChangeSchoolMembershipStatus', () => {
        class TestChangeSchoolMembershipStatus extends ChangeSchoolMembershipStatus {
            protected inputTypeName = 'TestChangeSchoolMembershipStatusInput'
            readonly partialEntity = {
                status: Status.ACTIVE,
                deleted_at: new Date(),
            }

            async authorize(): Promise<void> {
                throw new Error('not implemented')
            }

            async generateEntityMaps(): Promise<ChangeSchoolMembershipStatusEntityMap> {
                throw new Error('not implemented')
            }
        }

        context('validationOverAllInputs', () => {
            it('reject duplicate organizationIds', async () => {
                const callingUser = await createUser().save()
                const mutation = new TestChangeSchoolMembershipStatus(
                    [],
                    new UserPermissions(userToPayload(callingUser))
                )

                const duplicateSchoolId = uuid_v4()
                const notDuplicatedSchoolId = uuid_v4()

                const input = [
                    {
                        schoolId: duplicateSchoolId,
                        userIds: [uuid_v4()],
                    },
                    {
                        schoolId: duplicateSchoolId,
                        userIds: [uuid_v4()],
                    },
                    {
                        schoolId: notDuplicatedSchoolId,
                        userIds: [uuid_v4()],
                    },
                ]
                const {
                    validInputs,
                    apiErrors,
                } = mutation.validationOverAllInputs(input)
                expect(validInputs).to.have.length(2)
                expect(validInputs[0].index).to.eq(0)
                expect(validInputs[1].index).to.eq(2)
                expect(apiErrors).to.have.length(1)
                const error = createDuplicateAttributeAPIError(
                    1,
                    ['id'],
                    'TestChangeSchoolMembershipStatusInput'
                )
                compareErrors(apiErrors[0], error)
            })

            it('reject duplicate userIds per input element', async () => {
                const callingUser = await createUser().save()
                const mutation = new TestChangeSchoolMembershipStatus(
                    [],
                    new UserPermissions(userToPayload(callingUser))
                )

                const schoolId = uuid_v4()
                const duplicateUserId = uuid_v4()
                const notDuplicatedUserId = uuid_v4()

                const input = [
                    {
                        schoolId: schoolId,
                        userIds: [
                            duplicateUserId,
                            duplicateUserId,
                            notDuplicatedUserId,
                        ],
                    },
                ]
                const {
                    validInputs,
                    apiErrors,
                } = mutation.validationOverAllInputs(input)
                expect(validInputs).to.have.length(0)
                expect(apiErrors).to.have.length(1)
                const error = createDuplicateAttributeAPIError(
                    0,
                    ['userIds'],
                    'TestChangeSchoolMembershipStatusInput'
                )
                compareErrors(apiErrors[0], error)
            })
        })

        context('validate', () => {
            it('no errors when user and membership exists', async () => {
                const callingUser = await createUser().save()
                const mutation = new TestChangeSchoolMembershipStatus(
                    [],
                    new UserPermissions(userToPayload(callingUser))
                )
                const organization = createOrganization()
                organization.organization_id = uuid_v4()
                const school = createASchool(organization)
                school.school_id = uuid_v4()
                const user = createUser()
                user.user_id = uuid_v4()
                const membership = createSchoolMembership({
                    user,
                    school,
                })
                const maps = {
                    mainEntity: new Map(),
                    users: new Map([[user.user_id, user]]),
                    organizations: new Map([
                        [organization.organization_id, organization],
                    ]),
                    memberships: new ObjMap([
                        {
                            key: {
                                schoolId: school.school_id,
                                userId: user.user_id,
                            },
                            value: membership,
                        },
                    ]),
                    orgIds: [],
                }
                const input = {
                    userIds: [user.user_id],
                    schoolId: school.school_id,
                }
                const apiErrors = mutation.validate(0, school, input, maps)
                expect(apiErrors).to.have.length(0)
            })

            it('does not error if you try to alter your own membership', async () => {
                const callingUser = await createUser().save()
                const mutation = new TestChangeSchoolMembershipStatus(
                    [],
                    new UserPermissions(userToPayload(callingUser))
                )
                const school = createASchool()
                const membership = createSchoolMembership({
                    user: callingUser,
                    school,
                })
                const maps = {
                    mainEntity: new Map([[school.school_id, school]]),
                    users: new Map([[callingUser.user_id, callingUser]]),
                    memberships: new ObjMap([
                        {
                            key: {
                                schoolId: school.school_id,
                                userId: callingUser.user_id,
                            },
                            value: membership,
                        },
                    ]),
                    orgIds: [],
                }

                const input = {
                    userIds: [callingUser.user_id],
                    schoolId: school.school_id,
                }
                const apiErrors = mutation.validate(0, school, input, maps)
                expect(apiErrors).to.have.length(0)
            })

            it('errors when userIds are not found', async () => {
                const callingUser = await createUser().save()
                const mutation = new TestChangeSchoolMembershipStatus(
                    [],
                    new UserPermissions(userToPayload(callingUser))
                )
                const maps = {
                    mainEntity: new Map(),
                    users: new Map(),
                    memberships: new ObjMap<
                        { schoolId: string; userId: string },
                        SchoolMembership
                    >(),
                    orgIds: [],
                }

                const nonExistantUser = uuid_v4()

                const input = {
                    userIds: [nonExistantUser],
                    schoolId: uuid_v4(),
                }
                const apiErrors = mutation.validate(0, school, input, maps)
                expect(apiErrors).to.have.length(1)
                const error = createEntityAPIError(
                    'nonExistent',
                    0,
                    'User',
                    nonExistantUser
                )
                compareErrors(apiErrors[0], error)
            })

            it('errors when memberships are not found', async () => {
                const callingUser = await createUser().save()
                const mutation = new TestChangeSchoolMembershipStatus(
                    [],
                    new UserPermissions(userToPayload(callingUser))
                )
                const user = createUser()
                user.user_id = uuid_v4()
                const school = createASchool()
                school.school_id = uuid_v4()
                const maps = {
                    mainEntity: new Map([[school.school_id, school]]),
                    users: new Map([[user.user_id, user]]),
                    memberships: new ObjMap<
                        { schoolId: string; userId: string },
                        SchoolMembership
                    >(),
                    orgIds: [],
                }

                const nonExistantSchool = uuid_v4()

                const input = {
                    userIds: [user.user_id],
                    schoolId: nonExistantSchool,
                }
                const apiErrors = mutation.validate(0, school, input, maps)
                expect(apiErrors).to.have.length(1)
                const error = createEntityAPIError(
                    'nonExistentChild',
                    0,
                    'User',
                    user.user_id,
                    'School',
                    nonExistantSchool
                )
                compareErrors(apiErrors[0], error)
            })
        })

        context('process', () => {
            const makeMembership = (school: School) => {
                const user = createUser()
                user.user_id = uuid_v4()
                const membership = createSchoolMembership({
                    user,
                    school,
                    status: Status.INACTIVE,
                })
                return { membership, user }
            }

            it('sets the status to active', async () => {
                const clientUser = await createUser().save()
                const mutation = new TestChangeSchoolMembershipStatus(
                    [],
                    new UserPermissions(userToPayload(clientUser))
                )

                const school = createASchool()
                const { user, membership } = makeMembership(school)

                const maps = {
                    mainEntity: new Map([[school.school_id, school]]),
                    users: new Map([[user.user_id, user]]),
                    memberships: new ObjMap([
                        {
                            key: {
                                schoolId: school.school_id,
                                userId: user.user_id,
                            },
                            value: membership,
                        },
                    ]),
                    orgIds: [],
                }

                const input = {
                    schoolId: school.school_id,
                    userIds: [user.user_id],
                }
                const { outputEntity, modifiedEntity } = mutation.process(
                    input,
                    maps,
                    0
                )
                expect(outputEntity).to.deep.eq(school)
                expect(modifiedEntity).to.have.length(1)
                expect(modifiedEntity![0]).to.deep.eq(membership)
                expect(modifiedEntity![0]).deep.include(mutation.partialEntity)
            })
        })
    })

    const inputsForDifferentMembershipStatuses = async () => {
        const school = await createASchool().save()
        return Promise.all(
            Object.values(Status).map((status) =>
                createUser()
                    .save()
                    .then((user) => {
                        return createSchoolMembership({
                            user,
                            school,
                            roles: [],
                            status,
                        }).save()
                    })
                    .then((membership) => {
                        return {
                            schoolId: membership.school_id,
                            userIds: [membership.user_id],
                        }
                    })
            )
        )
    }

    const makeMembership = async (permissions: PermissionName[] = []) => {
        const user = await createUser().save()
        const organization = await createOrganization().save()
        const role = await roleFactory(undefined, organization, {
            permissions,
        }).save()
        const membership = await createOrganizationMembership({
            user,
            organization,
            roles: [role],
        }).save()
        return { user, organization, membership }
    }

    describe('ReactivateUsersFromOrganizations', () => {
        const makeMutation = (
            input: {
                schoolId: string
                userIds: string[]
            }[],
            user: User
        ) => {
            return new ReactivateUsersFromSchools(
                input,
                new UserPermissions(userToPayload(user))
            )
        }

        context('authorize', () => {
            it('rejects when user does not have reactivate_my_school_user_40886', async () => {
                const { user } = await makeMembership()
                const mutation = makeMutation([], user)
                const entityMap = {
                    orgIds: [uuid_v4()],
                }
                await expect(
                    mutation.authorize([], entityMap)
                ).to.eventually.rejectedWith(/reactivate_my_school_user_40886/)
            })

            it('resolves when user does have reactivate_my_school_user_40886', async () => {
                const { user, organization } = await makeMembership([
                    PermissionName.reactivate_my_school_user_40886,
                ])
                const entityMap = {
                    orgIds: [organization.organization_id],
                }
                const mutation = makeMutation([], user)
                await expect(mutation.authorize([], entityMap)).to.eventually
                    .fulfilled
            })
        })

        context('generateEntityMaps', () => {
            it('finds only inactive memberships', async () => {
                const input = await inputsForDifferentMembershipStatuses()

                const callingUser = await createUser().save()
                const mutation = makeMutation(input, callingUser)
                const entityMaps = await mutation.generateEntityMaps(input)
                expect(entityMaps.memberships.size).to.eq(1)
                expect(
                    Array.from(entityMaps.memberships.values())[0].status
                ).to.eq(Status.INACTIVE)
            })
        })
    })

    describe('DeleteUsersFromSchools', () => {
        const makeMutation = (
            input: {
                schoolId: string
                userIds: string[]
            }[],
            user: User
        ) => {
            return new DeleteUsersFromSchools(
                input,
                new UserPermissions(userToPayload(user))
            )
        }

        context('authorize', () => {
            it('rejects when user does not have delete_my_school_users_40441', async () => {
                const { user } = await makeMembership()
                const entityMap = {
                    orgIds: [uuid_v4()],
                }
                const mutation = makeMutation([], user)
                await expect(
                    mutation.authorize([], entityMap)
                ).to.eventually.rejectedWith(/delete_my_school_users_40441/)
            })

            it('resolves when user does have delete_my_school_users_40441', async () => {
                const { user, organization } = await makeMembership([
                    PermissionName.delete_my_school_users_40441,
                ])
                const mutation = makeMutation([], user)
                const entityMap = {
                    orgIds: [organization.organization_id],
                }
                await expect(mutation.authorize([], entityMap)).to.eventually
                    .fulfilled
            })
        })

        context('generateEntityMaps', () => {
            it('finds active and inactive memberships', async () => {
                const input = await inputsForDifferentMembershipStatuses()

                const callingUser = await createUser().save()
                const mutation = makeMutation(input, callingUser)
                const entityMaps = await mutation.generateEntityMaps(input)
                expect(entityMaps.memberships.size).to.eq(2)
                for (const [
                    index,
                    membership,
                ] of entityMaps.memberships.entries()) {
                    expect(membership.status).oneOf(
                        [Status.INACTIVE, Status.ACTIVE],
                        `membership ${index} has the wrong status of ${membership.status}`
                    )
                }
            })
        })
    })

    describe('RemoveUsersFromSchools', () => {
        const makeMutation = (
            input: {
                schoolId: string
                userIds: string[]
            }[],
            user: User
        ) => {
            return new RemoveUsersFromSchools(
                input,
                new UserPermissions(userToPayload(user))
            )
        }

        context('authorize', () => {
            it('rejects when user does not have deactivate_my_school_user_40885', async () => {
                const { user } = await makeMembership()
                const entityMap = {
                    orgIds: [uuid_v4()],
                }
                const mutation = makeMutation([], user)
                await expect(
                    mutation.authorize([], entityMap)
                ).to.eventually.rejectedWith(/deactivate_my_school_user_40885/)
            })

            it('resolves when user does have deactivate_my_school_user_40885', async () => {
                const { user, organization } = await makeMembership([
                    PermissionName.deactivate_my_school_user_40885,
                ])
                const entityMap = {
                    orgIds: [organization.organization_id],
                }
                const mutation = makeMutation([], user)
                await expect(mutation.authorize([], entityMap)).to.eventually
                    .fulfilled
            })
        })

        context('generateEntityMaps', () => {
            it('finds only active memberships', async () => {
                const input = await inputsForDifferentMembershipStatuses()
                const callingUser = await createUser().save()
                const mutation = makeMutation(input, callingUser)
                const entityMaps = await mutation.generateEntityMaps(input)
                expect(entityMaps.memberships.size).to.eq(1)
                expect(
                    Array.from(entityMaps.memberships.values())[0].status
                ).to.eq(Status.ACTIVE)
            })
        })
    })

    describe('AddProgramsToSchools', () => {
        let adminUser: User
        let nonAdminUser: User
        let schools: School[]
        let programs: Program[]
        let input: AddProgramsToSchoolInput[]

        function addPrograms(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return mutate(AddProgramsToSchools, { input }, permissions)
        }

        async function checkProgramsAddedToSchools() {
            for (const schoolInputs of input) {
                const { schoolId, programIds } = schoolInputs

                const sch = await School.findOne(schoolId)
                const dbPrograms = await sch?.programs

                const dbProgramIds = new Set(dbPrograms?.map((val) => val.id))
                const programIdsSet = new Set(programIds)

                expect(dbProgramIds.size).to.equal(programIdsSet.size)
                dbProgramIds.forEach(
                    (val) => expect(programIdsSet.has(val)).to.be.true
                )
            }
        }

        async function checkNoChangesMade(useAdminUser = true) {
            it('does not add the programs', async () => {
                await expect(
                    addPrograms(useAdminUser ? adminUser : nonAdminUser)
                ).to.be.rejected
                const insertedProgramList: Program[] = []
                for (const s of schools) {
                    const insertedPrograms = await s.programs
                    if (insertedPrograms) programs.push(...insertedPrograms)
                }
                expect(insertedProgramList).to.have.lengthOf(0)
            })
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            organization = await createOrganization().save()
            schools = createSchools(3)
            programs = createPrograms(4, organization)
            await connection.manager.save([...schools, ...programs])
            input = [
                {
                    schoolId: schools[0].school_id,
                    programIds: [programs[0].id],
                },
                {
                    schoolId: schools[1].school_id,
                    programIds: [programs[1].id, programs[2].id],
                },
                {
                    schoolId: schools[2].school_id,
                    programIds: [
                        programs[0].id,
                        programs[2].id,
                        programs[3].id,
                    ],
                },
            ]
        })

        context(
            'when caller has permissions to add programs to schools',
            () => {
                context('and all attributes are valid', () => {
                    it('adds all the programs', async () => {
                        await expect(addPrograms()).to.be.fulfilled
                        await checkProgramsAddedToSchools()
                    })
                })

                context('and one of the programs was already added', () => {
                    beforeEach(async () => {
                        schools[0].programs = Promise.resolve([programs[0]])
                        await schools[0].save()
                    })

                    it('returns a duplicate user error', async () => {
                        const res = await expect(addPrograms()).to.be.rejected
                        expectAPIError.existent_child_entity(
                            res,
                            {
                                entity: 'Program',
                                entityName: programs[0].id,
                                parentEntity: 'School',
                                parentName: schools[0].school_id,
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
                        const res = await expect(addPrograms()).to.be.rejected
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

                context('and one of the programs is inactive', async () => {
                    beforeEach(
                        async () => await programs[1].inactivate(getManager())
                    )

                    it('returns an nonexistent program error', async () => {
                        const res = await expect(addPrograms()).to.be.rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'Program',
                                id: programs[1].id,
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
                            programs[1].inactivate(getManager()),
                        ])
                    })

                    it('returns several nonexistent errors', async () => {
                        const res = await expect(addPrograms()).to.be.rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'School',
                                id: schools[2].school_id,
                                entryIndex: 2,
                            },
                            {
                                entity: 'Program',
                                id: programs[1].id,
                                entryIndex: 1,
                            },
                        ])
                    })

                    await checkNoChangesMade()
                })

                context('when adding 1 program then 20 programs', () => {
                    it('makes the same number of database calls', async () => {
                        const twentyPrograms = createPrograms(20, organization)
                        connection.logger.reset()
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                programIds: [programs[0].id],
                            },
                        ]
                        await expect(addPrograms()).to.be.fulfilled
                        const baseCount = connection.logger.count
                        await connection.manager.save([...twentyPrograms])
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                programIds: twentyPrograms.map((p) => p.id),
                            },
                        ]
                        connection.logger.reset()
                        await expect(addPrograms()).to.be.fulfilled
                        expect(connection.logger.count).to.equal(baseCount)
                    })
                })
            }
        )

        context(
            'when caller does not have permissions to add programs to all schools',
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
                    await expect(addPrograms(nonAdminUser)).to.be.rejectedWith(
                        errorMessage
                    )
                })

                await checkNoChangesMade(false)
            }
        )
    })

    describe('RemoveProgramsFromSchools', () => {
        let adminUser: User
        let nonAdminUser: User
        let schools: School[]
        let programs: Program[]
        const programLengths: number[] = []

        const programsCount = 6
        let input: RemoveProgramsFromSchoolInput[]

        function removePrograms(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return mutate(RemoveProgramsFromSchools, { input }, permissions)
        }

        async function checkOutput() {
            let index = 0
            for (const schoolInputs of input) {
                const { schoolId, programIds } = schoolInputs
                const programIdsSet = new Set(programIds)
                const sch = await School.findOne(schoolId)
                const dbPrograms = await sch?.programs

                const dbProgramIds = new Set(dbPrograms?.map((val) => val.id))
                expect(dbProgramIds.size).to.equal(
                    programLengths[index] - programIdsSet.size
                )
                expect(intersection(programIdsSet, dbProgramIds).size).equals(0)
                index++
            }
        }

        async function checkNoChangesMade(useAdminUser = true) {
            it('does not remove the programs', async () => {
                await expect(
                    removePrograms(useAdminUser ? adminUser : nonAdminUser)
                ).to.be.rejected
                const promises = schools.reduce(
                    (acc: Promise<Program[]>[], current) => {
                        if (current.programs) {
                            acc.push(current.programs)
                        }
                        return acc
                    },
                    []
                )
                const finalPrograms = (await Promise.all(promises)).flat()
                expect(finalPrograms).to.have.lengthOf(programsCount)
            })
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            organization = await createOrganization().save()
            schools = createSchools(3)
            programs = createPrograms(4, organization)
            await connection.manager.save([...schools, ...programs])
            schools[0].programs = Promise.resolve([programs[0]])
            programLengths.push((await schools[0].programs).length)
            schools[1].programs = Promise.resolve([programs[1], programs[2]])
            programLengths.push((await schools[1].programs).length)
            schools[2].programs = Promise.resolve([
                programs[0],
                programs[2],
                programs[3],
            ])
            programLengths.push((await schools[2].programs).length)
            await connection.manager.save(schools)
            input = [
                {
                    schoolId: schools[0].school_id,
                    programIds: [programs[0].id],
                },
                {
                    schoolId: schools[1].school_id,
                    programIds: [programs[1].id, programs[2].id],
                },
                {
                    schoolId: schools[2].school_id,
                    programIds: [programs[0].id, programs[2].id],
                },
            ]
        })

        context(
            'when caller has permissions to remove programs from schools',
            () => {
                context('and all attributes are valid', () => {
                    it('removes all the programs in the input, leaving any not in the input', async () => {
                        await expect(removePrograms()).to.be.fulfilled
                        await checkOutput()
                    })
                })

                context('and one of the programs was already removed', () => {
                    beforeEach(async () => {
                        schools[0].programs = Promise.resolve([])
                        await schools[0].save()
                    })

                    it('returns a duplicate user error', async () => {
                        const res = await expect(removePrograms()).to.be
                            .rejected
                        expectAPIError.nonexistent_child(
                            res,
                            {
                                entity: 'Program',
                                entityName: programs[0].id,
                                parentEntity: 'School',
                                parentName: schools[0].school_id,
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
                        const res = await expect(removePrograms()).to.be
                            .rejected
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

                context('and one of the programs is inactive', async () => {
                    beforeEach(
                        async () => await programs[1].inactivate(getManager())
                    )

                    it('returns an nonexistent program error', async () => {
                        const res = await expect(removePrograms()).to.be
                            .rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'Program',
                                id: programs[1].id,
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
                            programs[1].inactivate(getManager()),
                        ])
                    })

                    it('returns several nonexistent errors', async () => {
                        const res = await expect(removePrograms()).to.be
                            .rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'School',
                                id: schools[2].school_id,
                                entryIndex: 2,
                            },
                            {
                                entity: 'Program',
                                id: programs[1].id,
                                entryIndex: 1,
                            },
                        ])
                    })

                    await checkNoChangesMade()
                })

                context('when removing 1 program then 20 programs', () => {
                    it('makes the same number of database calls', async () => {
                        const twentyPrograms = createPrograms(20, organization)
                        connection.logger.reset()
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                programIds: [programs[0].id],
                            },
                        ]
                        await expect(removePrograms()).to.be.fulfilled
                        const baseCount = connection.logger.count
                        await connection.manager.save([...twentyPrograms])
                        schools[0].programs = Promise.resolve(twentyPrograms)
                        await schools[0].save()
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                programIds: twentyPrograms.map((p) => p.id),
                            },
                        ]
                        connection.logger.reset()
                        await expect(removePrograms()).to.be.fulfilled
                        expect(connection.logger.count).to.equal(baseCount)
                    })
                })
            }
        )

        context(
            'when caller does not have permissions to remove programs from all schools',
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
                    await expect(
                        removePrograms(nonAdminUser)
                    ).to.be.rejectedWith(errorMessage)
                })

                await checkNoChangesMade(false)
            }
        )
    })

    describe('RemoveClassesFromSchools', () => {
        let adminUser: User
        let nonAdminUser: User
        let schools: School[]
        let classes: Class[]
        const classLengths: number[] = []

        const classesCount = 6

        let input: RemoveClassesFromSchoolInput[]

        async function removeClasses(
            theInput: RemoveClassesFromSchoolInput[],
            authUser = adminUser
        ) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return await mutate(
                RemoveClassesFromSchools,
                { input: theInput },
                permissions
            )
        }

        async function checkOutput() {
            let index = 0
            for (const schoolInputs of input) {
                const { schoolId, classIds } = schoolInputs
                // eslint-disable-next-line no-await-in-loop
                const school1 = await School.findOne(schoolId)
                // eslint-disable-next-line no-await-in-loop
                const dbClasses = await school1?.classes

                const classIdsSet = new Set(classIds)

                const dbClassIds = new Set(
                    dbClasses?.map((val) => val.class_id)
                )
                expect(dbClassIds.size).to.equal(
                    classLengths[index] - classIdsSet.size
                )
                expect(intersection(classIdsSet, dbClassIds).size).equals(0)
                index++
            }
        }

        async function checkNoChangesMade(useAdminUser = true) {
            it(`does not remove the classes (useAdminUser=${useAdminUser})`, async () => {
                await expect(
                    removeClasses(
                        input,
                        useAdminUser ? adminUser : nonAdminUser
                    )
                ).to.be.rejected
                const promises = schools.reduce(
                    (acc: Promise<Class[]>[], current) => {
                        if (current.classes) {
                            acc.push(current.classes)
                        }
                        return acc
                    },
                    []
                )
                const finalClasses = (await Promise.all(promises)).flat()
                expect(finalClasses).to.have.lengthOf(classesCount)
            })
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            organization = await createOrganization(adminUser).save()
            schools = createSchools(3, organization)
            classes = createClasses(4, organization)
            await connection.manager.save([...schools, ...classes])

            schools[0].classes = Promise.resolve([classes[0]])
            classLengths.push((await schools[0].classes).length)
            schools[1].classes = Promise.resolve([classes[1], classes[2]])
            classLengths.push((await schools[1].classes).length)
            schools[2].classes = Promise.resolve([
                classes[0],
                classes[2],
                classes[3],
            ])
            classLengths.push((await schools[2].classes).length)

            await connection.manager.save(schools)

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

        context(
            'when caller has permissions to remove classes from schools',
            () => {
                context('and all attributes are valid', () => {
                    it("removes the schools' classes specified the input leaving any class not in the input", async () => {
                        await expect(removeClasses(input)).to.be.fulfilled
                        await checkOutput()
                    })
                })

                context(
                    'and the only class of school[0] was already removed',
                    () => {
                        beforeEach(async () => {
                            schools[0].classes = Promise.resolve([])
                            await schools[0].save()
                        })

                        it('returns a nonexistent child error', async () => {
                            const res = await expect(removeClasses(input)).to.be
                                .rejected
                            expectAPIError.nonexistent_child(
                                res,
                                {
                                    entity: 'Class',
                                    entityName: classes[0].class_id || '',
                                    parentEntity: 'School',
                                    parentName: schools[0].school_id || '',
                                    index: 0,
                                },
                                [''],
                                0,
                                1
                            )
                        })
                    }
                )

                context('and one of the schools is inactive', async () => {
                    beforeEach(async () => {
                        schools[2].status = Status.INACTIVE
                        await schools[2].save()
                    })

                    it('returns an nonexistent school error', async () => {
                        const res = await expect(removeClasses(input)).to.be
                            .rejected

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
                    beforeEach(async () => {
                        await classes[1].inactivate(getManager())
                    })

                    it('returns an nonexistent class error', async () => {
                        const res = await expect(removeClasses(input)).to.be
                            .rejected

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
                        schools[2].status = Status.INACTIVE
                        await Promise.all([
                            schools[2].save(),
                            classes[1].inactivate(getManager()),
                        ])
                    })

                    it('returns several nonexistent errors', async () => {
                        const res = await expect(removeClasses(input)).to.be
                            .rejected

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

                context('when removing 1 class then 20 classes', () => {
                    it('makes the same number of database calls', async () => {
                        const twentyClasses = createClasses(20, organization)
                        connection.logger.reset()
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                classIds: [classes[0].class_id],
                            },
                        ]
                        await expect(removeClasses(input)).to.be.fulfilled
                        const baseCount = connection.logger.count
                        await connection.manager.save([...twentyClasses])
                        schools[0].classes = Promise.resolve(twentyClasses)
                        await schools[0].save()
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                classIds: twentyClasses.map((p) => p.class_id),
                            },
                        ]
                        connection.logger.reset()
                        await expect(removeClasses(input)).to.be.fulfilled
                        expect(connection.logger.count).to.equal(baseCount)
                    })
                })
            }
        )

        context(
            'when caller does not have permissions to remove classes from all schools',
            async () => {
                beforeEach(async () => {
                    const nonAdminRole = await roleFactory(
                        'Non Admin Role',
                        organization,
                        {
                            permissions: [
                                PermissionName.attend_live_class_as_a_student_187,
                            ],
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
                    const sc = [schools[0], schools[1], schools[2]]
                    const errorMessage = buildPermissionError(
                        PermissionName.edit_school_20330,
                        nonAdminUser,
                        [organization],
                        sc
                    )
                    await expect(
                        removeClasses(input, nonAdminUser)
                    ).to.be.rejectedWith(errorMessage)
                })

                await checkNoChangesMade(false)
            }
        )
    })

    describe('AddUsersToSchools', () => {
        let adminUser: User
        let nonAdminUser: User

        let org: Organization
        let users: User[]
        let schools: School[]
        let roles: Role[]

        let input: AddUsersToSchoolInput[]

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)

            org = await createOrganization().save()
            schools = createSchools(2, org)
            users = createUsers(3)
            roles = createRoles(3)
            await connection.manager.save([...users, ...schools, ...roles])

            input = [
                {
                    schoolId: schools[0].school_id,
                    userIds: [users[0].user_id, users[1].user_id],
                    schoolRoleIds: [roles[0].role_id],
                },
                {
                    schoolId: schools[1].school_id,
                    userIds: [users[1].user_id, users[2].user_id],
                    schoolRoleIds: [roles[1].role_id],
                },
            ]
        })
        async function checkUsersAdded() {
            for (const i of input) {
                const memberships = await SchoolMembership.find({
                    where: {
                        school_id: i.schoolId,
                        user_id: In(i.userIds),
                        status: Status.ACTIVE,
                    },
                })
                expect(memberships.length).to.equal(i.userIds.length)
                expect(memberships.map((m) => m.user_id)).to.have.same.members(
                    i.userIds
                )

                for (const m of memberships) {
                    const mRoles = await m.roles
                    expect(mRoles?.map((r) => r.role_id)).to.have.same.members(
                        i.schoolRoleIds ?? []
                    )
                }
            }
        }

        async function checkNoChangesMade() {
            const memberships = await SchoolMembership.find({
                where: {
                    school_id: In(schools.map((s) => s.school_id)),
                    user_id: In(users.map((u) => u.user_id)),
                    status: Status.ACTIVE,
                },
            })
            expect(memberships).to.be.empty
        }

        function getAddUsersToSchools(clientUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(clientUser))
            return new AddUsersToSchools(input, permissions)
        }

        context('.run', () => {
            context('when all attributes are valid', () => {
                it('adds all the users', async () => {
                    await expect(getAddUsersToSchools().run()).to.be.fulfilled
                    await checkUsersAdded()
                })

                it('makes the expected number of db calls', async () => {
                    connection.logger.reset()
                    await getAddUsersToSchools().run()
                    expect(connection.logger.count).to.equal(
                        8,
                        'preload: 4, authorize: 1, save: 1 select for all memberships, 1 membership insert, 1 roles insert'
                    )
                })
            })
        })
        context('.authorize', () => {
            context('when caller has permissions', () => {
                it('does not raise an error', async () => {
                    const mutation = getAddUsersToSchools(adminUser)
                    const maps = await mutation.generateEntityMaps(input)
                    await expect(mutation.authorize(input, maps)).to.be
                        .fulfilled
                })
            })
            context('when caller does not have permissions', () => {
                beforeEach(async () => {
                    await createOrganizationMembership({
                        user: nonAdminUser,
                        organization: org,
                        roles: [],
                    }).save()
                })
                it('returns a permission error', async () => {
                    const mutation = getAddUsersToSchools(nonAdminUser)
                    const maps = await mutation.generateEntityMaps(input)
                    await expect(
                        mutation.authorize(input, maps)
                    ).to.be.rejectedWith(
                        buildPermissionError(
                            PermissionName.edit_school_20330,
                            nonAdminUser,
                            [org]
                        )
                    )
                    await checkNoChangesMade()
                })
            })
        })
        context('.validationOverAllInputs', () => {
            async function validateOverAllInputs() {
                const mutation = getAddUsersToSchools()
                const maps = await mutation.generateEntityMaps(input)
                return mutation.validationOverAllInputs(input, maps)
            }
            it('produces errors for nonexistent schools', async () => {
                await schools[0].inactivate(getManager())
                const result = await validateOverAllInputs()
                const xErrors = [
                    createEntityAPIError(
                        'nonExistent',
                        0,
                        'School',
                        schools[0].school_id
                    ),
                ]
                compareMultipleErrors(result.apiErrors, xErrors)
                expect(result.validInputs).to.have.length(1)
            })
            it('produces errors for duplicate schools', async () => {
                input.push(input[0])

                const result = await validateOverAllInputs()
                const xErrors = [
                    createDuplicateAttributeAPIError(
                        input.length - 1,
                        ['id'],
                        'AddUsersToSchoolInput'
                    ),
                ]
                compareMultipleErrors(result.apiErrors, xErrors)
                expect(result.validInputs).to.have.length(2)
            })
            context('subarrays', () => {
                context('userIds', () => {
                    it('checks for duplicates', async () => {
                        input[0].userIds.push(input[0].userIds[0])
                        const result = await validateOverAllInputs()
                        const xErrors = [
                            createDuplicateAttributeAPIError(
                                0,
                                ['userIds'],
                                'AddUsersToSchoolInput'
                            ),
                        ]
                        compareMultipleErrors(result.apiErrors, xErrors)
                        expect(result.validInputs).to.have.length(
                            input.length - 1
                        )
                    })
                    it('checks for length', async () => {
                        input[0].userIds = []
                        const result = await validateOverAllInputs()
                        const xErrors = [
                            createInputLengthAPIError(
                                'AddUsersToSchoolInput',
                                'min',
                                'userIds',
                                0
                            ),
                        ]
                        compareMultipleErrors(result.apiErrors, xErrors)
                        expect(result.validInputs).to.have.length(
                            input.length - 1
                        )
                    })
                })
            })
            context('subarrays', () => {
                context('schoolRoleIds', () => {
                    it('checks for duplicates', async () => {
                        input[0].schoolRoleIds!.push(input[0].schoolRoleIds![0])
                        const result = await validateOverAllInputs()
                        const xErrors = [
                            createDuplicateAttributeAPIError(
                                0,
                                ['schoolRoleIds'],
                                'AddUsersToSchoolInput'
                            ),
                        ]
                        compareMultipleErrors(result.apiErrors, xErrors)
                        expect(result.validInputs).to.have.length(
                            input.length - 1
                        )
                    })
                    it('checks for length', async () => {
                        input[0].schoolRoleIds = []
                        const result = await validateOverAllInputs()
                        const xErrors = [
                            createInputLengthAPIError(
                                'AddUsersToSchoolInput',
                                'min',
                                'schoolRoleIds',
                                0
                            ),
                        ]
                        compareMultipleErrors(result.apiErrors, xErrors)
                        expect(result.validInputs).to.have.length(
                            input.length - 1
                        )
                    })
                })
            })
        })
        context('.validate', () => {
            async function validate(clientUser = adminUser) {
                const mutation = getAddUsersToSchools(clientUser)
                const maps = await mutation.generateEntityMaps(input)
                return input.flatMap((i, index) =>
                    mutation.validate(
                        index,
                        maps.mainEntity.get(i.schoolId)!,
                        i,
                        maps
                    )
                )
            }
            context('when one of the users was already added', () => {
                beforeEach(async () => {
                    await createSchoolMembership({
                        user: users[0],
                        school: schools[0],
                    }).save()
                })
                it('returns a duplicate_child_entity error', async () => {
                    const errors = await validate()
                    const xErrors = [
                        createEntityAPIError(
                            'existentChild',
                            0,
                            'User',
                            users[0].user_id,
                            'School',
                            schools[0].school_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when one of the users is inactive', async () => {
                beforeEach(async () => await users[0].inactivate(getManager()))
                it('returns an nonexistent_entity error', async () => {
                    const errors = await validate()
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            users[0].user_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                    await checkNoChangesMade()
                })
            })

            context('when one of the roles is inactive', async () => {
                beforeEach(async () => await roles[0].inactivate(getManager()))
                it('returns an nonexistent_entity error', async () => {
                    const errors = await validate()
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'Role',
                            roles[0].role_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                    await checkNoChangesMade()
                })
            })

            context('when one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        users[2].inactivate(getManager()),
                        roles[1].inactivate(getManager()),
                    ])
                })
                it('returns several nonexistent_entity errors', async () => {
                    const errors = await validate()
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            1,
                            'Role',
                            roles[1].role_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            1,
                            'User',
                            users[2].user_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                    await checkNoChangesMade()
                })
            })
        })
    })
})
