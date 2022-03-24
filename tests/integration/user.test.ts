import { expect, use } from 'chai'
import { getManager, getConnection } from 'typeorm'
import { Model } from '../../src/model'
import { TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { User } from '../../src/entities/user'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { OrganizationOwnership } from '../../src/entities/organizationOwnership'
import {
    createOrganizationAndValidate,
    createOrganization,
    getClassesStudying,
    getClassesTeaching,
    getOrganizationMembership,
    getOrganizationMemberships,
    getSchoolMembership,
    getSchoolMemberships,
    getUserSchoolMembershipsWithPermission,
    mergeUser,
    updateUser,
    setPrimaryUser,
    updateUserEmail,
    getSubjectsTeaching,
    addSchoolToUser,
    MergeUserResponse,
    userToCreateUserInput,
    userToUpdateUserInput,
    randomChangeToUpdateUserInput,
    userToPayload,
} from '../utils/operations/userOps'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import {
    createSchool,
    createClass,
    createRole,
    addUserToOrganizationAndValidate,
} from '../utils/operations/organizationOps'
import {
    addStudentToClass,
    addTeacherToClass,
    editSubjects,
} from '../utils/operations/classOps'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { addOrganizationToUserAndValidate } from '../utils/operations/userOps'
import { addUserToSchool } from '../utils/operations/schoolOps'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { getNonAdminAuthToken, getAdminAuthToken } from '../utils/testConfig'
import { PermissionName } from '../../src/permissions/permissionNames'
import { grantPermission } from '../utils/operations/roleOps'
import { addRoleToOrganizationMembership } from '../utils/operations/organizationMembershipOps'
import {
    addRoleToSchoolMembership,
    schoolMembershipCheckAllowed,
} from '../utils/operations/schoolMembershipOps'
import { createUserAndValidate } from '../utils/operations/modelOps'
import { Organization } from '../../src/entities/organization'
import { Role } from '../../src/entities/role'
import { Class } from '../../src/entities/class'

import chaiAsPromised from 'chai-as-promised'
import { SHORTCODE_DEFAULT_MAXLEN } from '../../src/utils/shortcode'
import { Subject } from '../../src/entities/subject'
import { createClass as classFactory } from '../factories/class.factory'
import { createSubject } from '../factories/subject.factory'
import {
    createOrganization as organizationFactory,
    createOrganizations,
} from '../factories/organization.factory'
import {
    createSchool as schoolFactory,
    createSchools,
} from '../factories/school.factory'
import {
    createRole as roleFactory,
    createRoles,
} from '../factories/role.factory'
import {
    createUser,
    createUsers,
    createUsers as userFactory,
} from '../factories/user.factory'
import {
    createOrganizationMembership,
    createOrganizationMemberships,
} from '../factories/organizationMembership.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { School } from '../../src/entities/school'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { expectIsNonNullable } from '../utils/assertions'
import { compareErrors, compareMultipleErrors } from '../utils/apiError'
import {
    AddOrganizationRolesToUsers,
    AddSchoolRolesToUsers,
    AddSchoolRolesToUsersEntityMap,
    CreateUsers,
    removeOrganizationRolesFromUsers,
    RemoveSchoolRolesFromUsers,
    UpdateUsers,
} from '../../src/resolvers/user'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    AddOrganizationRolesToUserInput,
    AddSchoolRolesToUserInput,
    CreateUserInput,
    RemoveOrganizationRolesFromUserInput,
    RemoveSchoolRolesFromUserInput,
    UpdateUserInput,
    UserConnectionNode,
    UsersMutationResult,
} from '../../src/types/graphQL/user'
import { mapUserToUserConnectionNode } from '../../src/pagination/usersConnection'
import clean from '../../src/utils/clean'
import faker from 'faker'
import { v4 as uuid_v4 } from 'uuid'
import { config } from '../../src/config/config'
import { buildPermissionError } from '../utils/errors'
import { mutate } from '../../src/utils/mutations/commonStructure'
import { getMap } from '../../src/utils/resolvers/entityMaps'
import {
    createDuplicateAttributeAPIError,
    createDuplicateInputAttributeAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
    createInputRequiresAtLeastOne,
} from '../../src/utils/resolvers/errors'
import { mapRoleToRoleConnectionNode } from '../../src/pagination/rolesConnection'
import { APIError } from '../../src/types/errors/apiError'
import { customErrors } from '../../src/types/errors/customError'
import { createOrganization as createOrgFactory } from '../factories/organization.factory'
import { Status } from '../../src/entities/status'
import { ObjMap } from '../../src/utils/stringUtils'
import { OrganizationMembershipKey } from '../../src/utils/resolvers/user'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('user', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let adminUser: User
    let nonAdminUser: User
    let organization1: Organization
    let role1: Role
    let model: Model

    before(async () => {
        connection = getConnection() as TestConnection
        model = new Model(connection)
        const server = await createServer(model)
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        adminUser = await createAdminUser(testClient)
        nonAdminUser = await createNonAdminUser(testClient)
    })

    describe('set', () => {
        it('should set the specified user properties', async () => {
            const gqlUpdatedUser = await updateUser(testClient, adminUser, {
                authorization: getAdminAuthToken(),
            })
            const dbUser = await User.findOneOrFail({
                where: { user_id: adminUser.user_id },
            })
            expect(gqlUpdatedUser).to.exist
            expect(dbUser).to.include(gqlUpdatedUser)
            expect(dbUser.date_of_birth).to.eq(gqlUpdatedUser.date_of_birth)
            expect(dbUser.gender).to.eq(gqlUpdatedUser.gender)
            expect(dbUser.alternate_email).to.eq(gqlUpdatedUser.alternate_email)
            expect(dbUser.alternate_phone).to.eq(gqlUpdatedUser.alternate_phone)
        })
    })

    describe('setPrimary', () => {
        context("when primary user doesn't exists", () => {
            it('should set an user as primary', async () => {
                const gqlPrimaryUser = await setPrimaryUser(
                    testClient,
                    adminUser,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                const dbUser = await User.findOneOrFail({
                    where: { user_id: adminUser.user_id },
                })

                expect(gqlPrimaryUser).to.exist
                expect(dbUser).to.include(gqlPrimaryUser)
                expect(dbUser.primary).to.eq(gqlPrimaryUser.primary)
            })
        })

        context('when primary user already exists', () => {
            it('should unset it and set another as primary', async () => {
                await updateUserEmail(
                    testClient,
                    nonAdminUser,
                    adminUser.email as string,
                    {
                        authorization: getNonAdminAuthToken(),
                    }
                )

                const gqlPrimaryUser = await setPrimaryUser(
                    testClient,
                    adminUser,
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                const gqlNewPrimaryUser = await setPrimaryUser(
                    testClient,
                    nonAdminUser,
                    { authorization: getNonAdminAuthToken() }
                )

                const dbUser = await User.findOneOrFail({
                    where: { user_id: adminUser.user_id },
                })
                const dbNewPrimaryUser = await User.findOneOrFail({
                    where: { user_id: nonAdminUser.user_id },
                })

                expect(gqlPrimaryUser).to.exist
                expect(dbUser.primary).to.eql(false)

                expect(gqlNewPrimaryUser).to.exist
                expect(dbNewPrimaryUser).to.include(gqlNewPrimaryUser)
                expect(dbNewPrimaryUser.primary).to.eql(true)
            })
        })

        it('should unset the current primary user and set another as primary', async () => {
            await updateUserEmail(
                testClient,
                nonAdminUser,
                adminUser.email as string,
                {
                    authorization: getNonAdminAuthToken(),
                }
            )

            const gqlPrimaryUser = await setPrimaryUser(testClient, adminUser, {
                authorization: getAdminAuthToken(),
            })
            const gqlNewPrimaryUser = await setPrimaryUser(
                testClient,
                nonAdminUser,
                {
                    authorization: getNonAdminAuthToken(),
                }
            )

            const dbUser = await User.findOneOrFail({
                where: { user_id: adminUser.user_id },
            })
            const dbNewPrimaryUser = await User.findOneOrFail({
                where: { user_id: nonAdminUser.user_id },
            })

            expect(gqlPrimaryUser).to.exist
            expect(dbUser.primary).to.eql(false)

            expect(gqlNewPrimaryUser).to.exist
            expect(dbNewPrimaryUser).to.include(gqlNewPrimaryUser)
            expect(dbNewPrimaryUser.primary).to.eql(true)
        })
    })

    describe('memberships', () => {
        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlMemberships = await getOrganizationMemberships(
                    testClient,
                    adminUser,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlMemberships).to.exist
                expect(gqlMemberships).to.be.empty
            })
        })

        context('when one', () => {
            beforeEach(async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
                await addOrganizationToUserAndValidate(
                    testClient,
                    adminUser.user_id,
                    organization.organization_id
                )
            })

            it('should return an array containing one organization membership', async () => {
                const gqlMemberships = await getOrganizationMemberships(
                    testClient,
                    adminUser,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlMemberships).to.exist
                expect(gqlMemberships.length).to.equal(1)
            })
        })
    })

    describe('membership', () => {
        let organizationId: string

        beforeEach(async () => {
            const organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            organizationId = organization.organization_id
            await addOrganizationToUserAndValidate(
                testClient,
                adminUser.user_id,
                organizationId
            )
        })

        it('should get the organization membership associated with the specified organization ID', async () => {
            const gqlMembership = await getOrganizationMembership(
                testClient,
                adminUser.user_id,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            const dbMembership = await OrganizationMembership.findOneOrFail({
                where: {
                    user_id: adminUser.user_id,
                    organization_id: organizationId,
                },
            })

            expect(gqlMembership).to.exist
            expect(dbMembership).to.include(gqlMembership)
        })
    })

    describe('school_memberships', () => {
        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlMemberships = await getSchoolMemberships(
                    testClient,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlMemberships).to.exist
                expect(gqlMemberships).to.be.empty
            })
        })

        context('when one', () => {
            beforeEach(async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
                const school = await createSchool(
                    testClient,
                    organization.organization_id,
                    'my school',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToSchool(
                    testClient,
                    adminUser.user_id,
                    school.school_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return an array containing one school membership', async () => {
                const gqlMemberships = await getSchoolMemberships(
                    testClient,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlMemberships).to.exist
                expect(gqlMemberships.length).to.equal(1)
            })
        })
    })

    describe('school_membership', () => {
        let schoolId: string

        beforeEach(async () => {
            const organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            const school = await createSchool(
                testClient,
                organization.organization_id,
                'my school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            schoolId = school.school_id
            await addUserToSchool(testClient, adminUser.user_id, schoolId, {
                authorization: getAdminAuthToken(),
            })
        })

        it('should get school membership', async () => {
            const gqlMembership = await getSchoolMembership(
                testClient,
                adminUser.user_id,
                schoolId,
                { authorization: getAdminAuthToken() }
            )
            const dbMembership = await SchoolMembership.findOneOrFail({
                where: {
                    user_id: adminUser.user_id,
                    school_id: schoolId,
                },
            })

            expect(gqlMembership).to.exist
            expect(dbMembership).to.include(gqlMembership)
        })
    })

    describe('classesTeaching', () => {
        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlClasses = await getClassesTeaching(
                    testClient,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlClasses).to.exist
                expect(gqlClasses).to.be.empty
            })
        })

        context('when one', async () => {
            beforeEach(async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
                const cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                await addTeacherToClass(
                    testClient,
                    cls.class_id,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return an array containing one class', async () => {
                const gqlClasses = await getClassesTeaching(
                    testClient,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlClasses).to.exist
                expect(gqlClasses).to.have.lengthOf(1)
            })
        })
    })

    describe('classesStudying', () => {
        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlClasses = await getClassesStudying(
                    testClient,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlClasses).to.exist
                expect(gqlClasses).to.be.empty
            })
        })

        context('when one', () => {
            beforeEach(async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
                const cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                await addStudentToClass(
                    testClient,
                    cls.class_id,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return an array containing one class', async () => {
                const gqlClasses = await getClassesStudying(
                    testClient,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlClasses).to.exist
                expect(gqlClasses).to.have.lengthOf(1)
            })
        })
    })

    describe('createOrganization', () => {
        const shortcode_re = /^[A-Z|0-9]+$/

        it('should create an organization', async () => {
            const organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            expect(organization).to.exist
            expect(organization.shortCode).to.match(shortcode_re)
            expect(organization.shortCode?.length).to.equal(
                SHORTCODE_DEFAULT_MAXLEN
            )
        })

        context('when organization shortcode is undefined', () => {
            it('creates an organization', async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id,
                    undefined,
                    undefined
                )
                expect(organization).to.exist
                expect(organization.shortCode).to.match(shortcode_re)
                expect(organization.shortCode).not.to.be.undefined
            })
        })

        context('when organization shortcode is empty', () => {
            it('creates an organization', async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id,
                    undefined,
                    ''
                )
                expect(organization).to.exist
                expect(organization.shortCode).to.match(shortcode_re)
                expect(organization.shortCode).not.to.be.empty
            })
        })

        context('when organization shortcode is not empty', () => {
            context('and the shortcode is valid', () => {
                it('creates an organization', async () => {
                    const organization = await createOrganizationAndValidate(
                        testClient,
                        adminUser.user_id,
                        undefined,
                        'happy1'
                    )
                    expect(organization).to.exist
                    expect(organization.shortCode).to.match(shortcode_re)
                    expect(organization.shortCode).to.equal('HAPPY1')
                })
            })

            context('and the shortcode is not valid', () => {
                it('should fail to create an organization with a bad short code', async () => {
                    await expect(
                        createOrganization(
                            testClient,
                            adminUser.user_id,
                            'A name',
                            'very wrong'
                        )
                    ).to.be.rejected
                })
            })
        })

        it('creates the organization ownership', async () => {
            const organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            const organizationOwnership = await OrganizationOwnership.find({
                where: {
                    organization_id: organization.organization_id,
                    user_id: adminUser.user_id,
                },
            })

            expect(organizationOwnership).to.exist
        })

        context('when the user already has an active organisation', () => {
            beforeEach(async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
            })

            it('does not create another organisation', async () => {
                await expect(
                    createOrganization(
                        testClient,
                        adminUser.user_id,
                        'Another Org'
                    )
                ).to.be.rejected
            })
        })
    })

    describe('addOrganization', () => {
        let organizationId: string

        beforeEach(async () => {
            const organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            organizationId = organization.organization_id
        })

        it('user should join the specified organization', async () => {
            const membership = await addOrganizationToUserAndValidate(
                testClient,
                adminUser.user_id,
                organizationId
            )
            expect(membership).to.exist
        })
    })

    describe('schoolsWithPermission', () => {
        let organization1Id: string
        let school1Id: string
        let school2Id: string
        let org1RoleId: string
        let org2RoleId: string
        let idOfUserToBeQueried: string
        let tokenOfOrg1Owner: string
        let tokenOfOrg2Owner: string
        const permissionName = PermissionName.edit_role_and_permissions_30332
        const userToBeQueried = {
            email: 'testuser@gmail.com',
        } as User
        let arbitraryUserToken: string

        beforeEach(async () => {
            tokenOfOrg1Owner = getAdminAuthToken()
            const idOfOrg1Owner = adminUser.user_id
            const idOfOrg2Owner = (await createNonAdminUser(testClient)).user_id
            tokenOfOrg2Owner = getNonAdminAuthToken()
            idOfUserToBeQueried = (
                await createUserAndValidate(testClient, userToBeQueried)
            ).user_id
            organization1Id = (
                await createOrganizationAndValidate(testClient, idOfOrg1Owner)
            ).organization_id
            const organization2Id = (
                await createOrganizationAndValidate(
                    testClient,
                    idOfOrg2Owner,
                    tokenOfOrg2Owner
                )
            ).organization_id
            await addOrganizationToUserAndValidate(
                testClient,
                idOfUserToBeQueried,
                organization1Id,
                tokenOfOrg1Owner
            )
            await addOrganizationToUserAndValidate(
                testClient,
                idOfUserToBeQueried,
                organization2Id,
                tokenOfOrg2Owner
            )
            school1Id = (
                await createSchool(
                    testClient,
                    organization1Id,
                    'School 1',
                    undefined,
                    { authorization: tokenOfOrg1Owner }
                )
            ).school_id
            school2Id = (
                await createSchool(
                    testClient,
                    organization2Id,
                    'School 2',
                    undefined,
                    { authorization: tokenOfOrg2Owner }
                )
            ).school_id
            await addUserToSchool(testClient, idOfUserToBeQueried, school1Id, {
                authorization: tokenOfOrg1Owner,
            })
            await addUserToSchool(testClient, idOfUserToBeQueried, school2Id, {
                authorization: tokenOfOrg2Owner,
            })
            await addUserToSchool(testClient, idOfOrg1Owner, school1Id, {
                authorization: tokenOfOrg1Owner,
            })
            await addUserToSchool(testClient, idOfOrg1Owner, school2Id, {
                authorization: tokenOfOrg2Owner,
            })
            org1RoleId = (
                await createRole(testClient, organization1Id, 'Org 1 Role')
            ).role_id
            org2RoleId = (
                await createRole(
                    testClient,
                    organization2Id,
                    'Org 2 Role',
                    'Org 2 role description',
                    tokenOfOrg2Owner
                )
            ).role_id
            await grantPermission(testClient, org1RoleId, permissionName, {
                authorization: tokenOfOrg1Owner,
            })
            await grantPermission(testClient, org2RoleId, permissionName, {
                authorization: tokenOfOrg2Owner,
            })

            await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()
        })

        context(
            "when user being queried has the specified permission in a school's organization",
            () => {
                beforeEach(async () => {
                    await addRoleToSchoolMembership(
                        testClient,
                        idOfUserToBeQueried,
                        school1Id,
                        org1RoleId,
                        { authorization: tokenOfOrg1Owner }
                    )
                })

                it('should return an array containing one school membership', async () => {
                    const gqlMemberships = await getUserSchoolMembershipsWithPermission(
                        testClient,
                        idOfUserToBeQueried,
                        permissionName,
                        { authorization: tokenOfOrg1Owner }
                    )
                    const isAllowed = await schoolMembershipCheckAllowed(
                        testClient,
                        idOfUserToBeQueried,
                        school1Id,
                        permissionName,
                        { authorization: arbitraryUserToken }
                    )
                    expect(isAllowed).to.be.true
                    expect(gqlMemberships).to.exist
                    expect(gqlMemberships.length).to.equal(1)
                })
            }
        )

        context(
            "when user being queried does not have the specified permission in a school's organization",
            () => {
                it('should return an empty array', async () => {
                    const gqlMemberships = await getUserSchoolMembershipsWithPermission(
                        testClient,
                        idOfUserToBeQueried,
                        permissionName,
                        { authorization: tokenOfOrg1Owner }
                    )
                    const isAllowed = await schoolMembershipCheckAllowed(
                        testClient,
                        idOfUserToBeQueried,
                        school1Id,
                        permissionName,
                        { authorization: arbitraryUserToken }
                    )
                    expect(isAllowed).to.be.false
                    expect(gqlMemberships).to.exist
                    expect(gqlMemberships.length).to.equal(0)
                })
            }
        )

        context(
            'when user being queried has the specified permission in a school',
            () => {
                beforeEach(async () => {
                    await addRoleToSchoolMembership(
                        testClient,
                        idOfUserToBeQueried,
                        school1Id,
                        org1RoleId,
                        { authorization: tokenOfOrg1Owner }
                    )
                })

                it('should return an array containing one school membership', async () => {
                    const gqlMemberships = await getUserSchoolMembershipsWithPermission(
                        testClient,
                        idOfUserToBeQueried,
                        permissionName,
                        { authorization: tokenOfOrg1Owner }
                    )
                    const isAllowed = await schoolMembershipCheckAllowed(
                        testClient,
                        idOfUserToBeQueried,
                        school1Id,
                        permissionName,
                        { authorization: arbitraryUserToken }
                    )
                    expect(isAllowed).to.be.true
                    expect(gqlMemberships).to.exist
                    expect(gqlMemberships.length).to.equal(1)
                })
            }
        )

        context(
            'when user being queried does not have the specified permission in a school',
            () => {
                it('should return an empty array', async () => {
                    const gqlMemberships = await getUserSchoolMembershipsWithPermission(
                        testClient,
                        idOfUserToBeQueried,
                        permissionName,
                        { authorization: tokenOfOrg1Owner }
                    )
                    const isAllowed = await schoolMembershipCheckAllowed(
                        testClient,
                        idOfUserToBeQueried,
                        school1Id,
                        permissionName,
                        { authorization: arbitraryUserToken }
                    )
                    expect(isAllowed).to.be.false
                    expect(gqlMemberships).to.exist
                    expect(gqlMemberships.length).to.equal(0)
                })
            }
        )

        context(
            'when user being queried has the specified permission in organization 1 and in school 2 of organization 2',
            () => {
                beforeEach(async () => {
                    await addRoleToOrganizationMembership(
                        testClient,
                        idOfUserToBeQueried,
                        organization1Id,
                        org1RoleId,
                        { authorization: tokenOfOrg1Owner }
                    )
                    await addRoleToSchoolMembership(
                        testClient,
                        idOfUserToBeQueried,
                        school2Id,
                        org2RoleId,
                        { authorization: tokenOfOrg2Owner }
                    )
                })

                it('should return an array containing two school memberships', async () => {
                    const gqlMemberships = await getUserSchoolMembershipsWithPermission(
                        testClient,
                        idOfUserToBeQueried,
                        permissionName,
                        { authorization: tokenOfOrg1Owner }
                    )
                    const isAllowed1 = await schoolMembershipCheckAllowed(
                        testClient,
                        idOfUserToBeQueried,
                        school1Id,
                        permissionName,
                        { authorization: arbitraryUserToken }
                    )
                    const isAllowed2 = await schoolMembershipCheckAllowed(
                        testClient,
                        idOfUserToBeQueried,
                        school2Id,
                        permissionName,
                        { authorization: arbitraryUserToken }
                    )
                    expect(isAllowed1).to.be.true
                    expect(isAllowed2).to.be.true
                    expect(gqlMemberships).to.exist
                    expect(gqlMemberships.length).to.equal(2)
                })
            }
        )
    })
    describe('merge', () => {
        let school: School
        let oldUser: User
        let newUser: User

        beforeEach(async () => {
            organization1 = await organizationFactory(adminUser).save()
            role1 = await roleFactory(undefined, organization1).save()
            school = await schoolFactory(organization1).save()

            oldUser = await createUser().save()

            newUser = await createUser().save()
            await createOrganizationMembership({
                user: newUser,
                organization: organization1,
                roles: [role1],
            }).save()
            await createSchoolMembership({
                user: newUser,
                school,
                roles: [role1],
            }).save()
        })

        const expectMergedOrgMemberships = (
            memberships: Pick<
                OrganizationMembership,
                'user_id' | 'organization_id'
            >[],
            organizations: Organization[]
        ) => {
            expect(memberships).to.exist
            expect(memberships).to.have.length(organizations.length)
            expect(memberships.map((m) => m.user_id)).to.deep.equal(
                Array.from({ length: organizations.length }).fill(
                    oldUser.user_id
                )
            )
            expect(
                memberships.map((m) => m.organization_id)
            ).to.deep.equalInAnyOrder(
                organizations.map((o) => o.organization_id)
            )
        }

        const expectMergedSchoolMemberships = (
            schoolMemberships: Pick<
                SchoolMembership,
                'school_id' | 'user_id'
            >[],
            schools: School[]
        ) => {
            expect(schoolMemberships).to.exist
            expect(schoolMemberships).to.have.length(schools.length)
            expect(schoolMemberships.map((m) => m.user_id)).to.deep.equal(
                Array.from({ length: schools.length }).fill(oldUser.user_id)
            )
            expect(
                schoolMemberships.map((m) => m.school_id)
            ).to.deep.equalInAnyOrder(schools.map((s) => s.school_id))
        }

        const expectMergedClassesStudying = (
            classesStudying: Pick<Class, 'class_id'>[],
            classes: Class[]
        ) => {
            expect(classesStudying).to.exist
            expect(classesStudying).to.have.length(classes.length)
            expect(
                classesStudying.map((c) => c.class_id)
            ).to.deep.equalInAnyOrder(classes.map((c) => c.class_id))
        }

        /**
         * Expect the GraphQL response to contain the merged User
         */
        const expectMergeResponse = ({
            response,
            schools,
            organizations,
            classesStudying,
        }: {
            response: MergeUserResponse
            schools: School[]
            organizations: Organization[]
            classesStudying: Class[]
        }) => {
            expectIsNonNullable(response)
            expect(response.user_id).to.equal(oldUser.user_id)

            expectMergedOrgMemberships(response.memberships, organizations)
            expectMergedSchoolMemberships(response.school_memberships, schools)
            expectMergedClassesStudying(
                response.classesStudying,
                classesStudying
            )
        }

        /**
         * Expect the User in the database to have been merged
         */
        const expectMergedUser = async ({
            organizations,
            schools,
            classesStudying,
        }: {
            schools: School[]
            organizations: Organization[]
            classesStudying: Class[]
        }) => {
            const dbOldUser = await User.findOneOrFail({
                where: { user_id: oldUser.user_id },
            })

            const newOrganizationMemberships = await dbOldUser.memberships
            expectIsNonNullable(newOrganizationMemberships)
            expectMergedOrgMemberships(
                newOrganizationMemberships,
                organizations
            )

            const newSchoolMemberships = await dbOldUser.school_memberships
            expectIsNonNullable(newSchoolMemberships)
            expectMergedSchoolMemberships(newSchoolMemberships, schools)

            const newClassesStudying = await dbOldUser.classesStudying
            expectIsNonNullable(newClassesStudying)
            expectMergedClassesStudying(newClassesStudying, classesStudying)
        }

        const expectDeletedNewUser = async () =>
            expect(
                await User.findOne({
                    where: { user_id: newUser.user_id },
                })
            ).to.be.undefined

        it('should merge one user into another deleting the source user', async () => {
            const gqlUser = await mergeUser(
                testClient,
                oldUser.user_id,
                newUser.user_id,
                { authorization: getAdminAuthToken() }
            )

            expectMergeResponse({
                response: gqlUser,
                schools: [school],
                organizations: [organization1],
                classesStudying: [],
            })

            await expectMergedUser({
                schools: [school],
                organizations: [organization1],
                classesStudying: [],
            })

            await expectDeletedNewUser()
        })
        it('should merge one user into another including classes deleting the source user', async () => {
            const cls = classFactory([], organization1)
            cls.students = Promise.resolve([newUser])
            await cls.save()

            const gqlUser = await mergeUser(
                testClient,
                oldUser.user_id,
                newUser.user_id,
                { authorization: getAdminAuthToken() }
            )

            expectMergeResponse({
                response: gqlUser,
                schools: [school],
                organizations: [organization1],
                classesStudying: [cls],
            })

            await expectMergedUser({
                schools: [school],
                organizations: [organization1],
                classesStudying: [cls],
            })

            await expectDeletedNewUser()
        })
    })
    describe('subjectsTeaching', () => {
        let organization: Organization
        let cls: Class
        let subject: Subject
        let role: Role

        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlSubjects = await getSubjectsTeaching(
                    testClient,
                    adminUser.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlSubjects).to.be.empty
            })
        })
        context('and is an ordinary user', () => {
            context('and the user is a member of the organization', () => {
                context('when one', async () => {
                    let subject_id: string
                    beforeEach(async () => {
                        organization = await createOrganizationAndValidate(
                            testClient,
                            adminUser.user_id
                        )
                        role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await Promise.all([
                            grantPermission(
                                testClient,
                                role.role_id,
                                'add_students_to_class_20225',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'add_teachers_to_class_20226',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'create_subjects_20227',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'edit_subjects_20337',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'edit_class_20334',
                                { authorization: getAdminAuthToken() }
                            ),
                        ])
                        await addOrganizationToUserAndValidate(
                            testClient,
                            nonAdminUser.user_id,
                            organization.organization_id,
                            getAdminAuthToken()
                        )
                        cls = await createClass(
                            testClient,
                            organization.organization_id
                        )
                        await addTeacherToClass(
                            testClient,
                            cls.class_id,
                            nonAdminUser.user_id,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            nonAdminUser.user_id,
                            organization.organization_id,
                            role.role_id
                        )

                        subject = createSubject(organization)
                        await subject.save()
                        subject_id = subject.id
                        await editSubjects(
                            testClient,
                            cls.class_id,
                            [subject.id],
                            { authorization: getNonAdminAuthToken() }
                        )
                    })
                    it('should return an array containing one subject', async () => {
                        const gqlSubjects = await getSubjectsTeaching(
                            testClient,
                            nonAdminUser.user_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSubjects).to.exist
                        expect(gqlSubjects).to.have.lengthOf(1)
                        expect(gqlSubjects[0].id).to.equal(subject_id)
                    })
                })
            })
            context('and the user is a not member of the organization', () => {
                context('when one', async () => {
                    beforeEach(async () => {
                        organization = await createOrganizationAndValidate(
                            testClient,
                            adminUser.user_id
                        )
                        role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await Promise.all([
                            grantPermission(
                                testClient,
                                role.role_id,
                                'add_students_to_class_20225',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'add_teachers_to_class_20226',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'create_subjects_20227',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'edit_subjects_20337',
                                { authorization: getAdminAuthToken() }
                            ),
                            grantPermission(
                                testClient,
                                role.role_id,
                                'edit_class_20334',
                                { authorization: getAdminAuthToken() }
                            ),
                        ])
                        await addOrganizationToUserAndValidate(
                            testClient,
                            adminUser.user_id,
                            organization.organization_id,
                            getAdminAuthToken()
                        )
                        cls = await createClass(
                            testClient,
                            organization.organization_id
                        )
                        await addTeacherToClass(
                            testClient,
                            cls.class_id,
                            adminUser.user_id,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            adminUser.user_id,
                            organization.organization_id,
                            role.role_id
                        )

                        subject = createSubject(organization)
                        await subject.save()
                        await editSubjects(
                            testClient,
                            cls.class_id,
                            [subject.id],
                            { authorization: getAdminAuthToken() }
                        )
                    })
                    it('should return an empty', async () => {
                        const gqlSubjects = await getSubjectsTeaching(
                            testClient,
                            adminUser.user_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlSubjects).to.be.empty
                    })
                })
            })
        })
        context('and is an admin user', () => {
            context(
                'and the admin user is not a member of the organization',
                () => {
                    context('when one', async () => {
                        let subject_id: string
                        beforeEach(async () => {
                            organization = await createOrganizationAndValidate(
                                testClient,
                                nonAdminUser.user_id
                            )
                            role = await createRole(
                                testClient,
                                organization.organization_id,
                                getNonAdminAuthToken()
                            )
                            await Promise.all([
                                grantPermission(
                                    testClient,
                                    role.role_id,
                                    'add_students_to_class_20225',
                                    { authorization: getNonAdminAuthToken() }
                                ),
                                grantPermission(
                                    testClient,
                                    role.role_id,
                                    'add_teachers_to_class_20226',
                                    { authorization: getNonAdminAuthToken() }
                                ),
                                grantPermission(
                                    testClient,
                                    role.role_id,
                                    'create_subjects_20227',
                                    { authorization: getNonAdminAuthToken() }
                                ),
                                grantPermission(
                                    testClient,
                                    role.role_id,
                                    'edit_subjects_20337',
                                    { authorization: getNonAdminAuthToken() }
                                ),
                                grantPermission(
                                    testClient,
                                    role.role_id,
                                    'edit_class_20334',
                                    { authorization: getNonAdminAuthToken() }
                                ),
                            ])

                            cls = await createClass(
                                testClient,
                                organization.organization_id,
                                getNonAdminAuthToken()
                            )
                            await addTeacherToClass(
                                testClient,
                                cls.class_id,
                                nonAdminUser.user_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                            await addRoleToOrganizationMembership(
                                testClient,
                                nonAdminUser.user_id,
                                organization.organization_id,
                                role.role_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                            await addOrganizationToUserAndValidate(
                                testClient,
                                nonAdminUser.user_id,
                                organization.organization_id,
                                getNonAdminAuthToken()
                            )
                            subject = createSubject(organization)
                            await subject.save()
                            subject_id = subject.id
                            await editSubjects(
                                testClient,
                                cls.class_id,
                                [subject.id],
                                { authorization: getNonAdminAuthToken() }
                            )
                        })
                        it('should return an array of one subject', async () => {
                            const gqlSubjects = await getSubjectsTeaching(
                                testClient,
                                nonAdminUser.user_id,
                                { authorization: getAdminAuthToken() }
                            )
                            expect(gqlSubjects).to.exist
                            expect(gqlSubjects).to.have.lengthOf(1)
                            expect(gqlSubjects[0].id).to.equal(subject_id)
                        })
                    })
                }
            )
        })
    })

    describe('addSchool', () => {
        let idOfUserPerformingOperation: string
        let idOfUserJoiningSchool: string
        let organizationId: string
        let schoolId: string
        let arbitraryUserToken: string

        beforeEach(async () => {
            await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()
            const orgOwner = await createAdminUser(testClient)
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
            ).organization_id
            idOfUserPerformingOperation = (await createNonAdminUser(testClient))
                .user_id
            idOfUserJoiningSchool = idOfUserPerformingOperation
            schoolId = (
                await createSchool(
                    testClient,
                    organizationId,
                    'My School',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
            ).school_id
        })

        context('when not authorized within organization', () => {
            context('and user being added is part of the organization', () => {
                beforeEach(async () => {
                    await addUserToOrganizationAndValidate(
                        testClient,
                        idOfUserJoiningSchool,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('user should join the specified school', async () => {
                    const membership = await addSchoolToUser(
                        testClient,
                        idOfUserPerformingOperation,
                        schoolId,
                        { authorization: arbitraryUserToken }
                    )
                    expect(membership).to.exist
                    await SchoolMembership.findOneOrFail({
                        user_id: idOfUserJoiningSchool,
                        school_id: schoolId,
                    })
                })
            })

            context(
                'and user being added is not part of the organization',
                () => {
                    it('user should join the specified school', async () => {
                        const membership = await addSchoolToUser(
                            testClient,
                            idOfUserPerformingOperation,
                            schoolId,
                            { authorization: arbitraryUserToken }
                        )
                        expect(membership).to.exist
                        await SchoolMembership.findOneOrFail({
                            user_id: idOfUserJoiningSchool,
                            school_id: schoolId,
                        })
                    })
                }
            )
        })
    })

    describe('CreateUsers', () => {
        let idOfUserPerformingOperation: string
        let organizationId: string
        let arbitraryUserToken: string
        let createUserInputs: CreateUserInput[]
        let adminToken: string

        function createUsersResolver(input: CreateUserInput[], user: User) {
            return mutate(
                CreateUsers,
                { input },
                new UserPermissions({
                    id: user.user_id,
                    email: user.email,
                    phone: user.phone,
                })
            )
        }

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            idOfUserPerformingOperation = nonAdminUser.user_id
            arbitraryUserToken = getNonAdminAuthToken()
            adminUser = await createAdminUser(testClient)
            adminToken = getAdminAuthToken()
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
            ).organization_id

            createUserInputs = [
                ...Array(config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE),
            ].map((_) => userToCreateUserInput(createUser()))
        })

        context('when not authorized', () => {
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                await expect(
                    createUsersResolver(createUserInputs, nonAdminUser)
                ).to.be.rejected
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('when admin', () => {
            it('creates users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                const createUsersResult = await createUsersResolver(
                    createUserInputs,
                    adminUser
                )
                const userConNodes = createUsersResult.users
                expect(userConNodes.length).to.equal(createUserInputs.length)
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers - previousUsers).to.equal(
                    createUserInputs.length
                )
            })
        })
        context('when user has permission', () => {
            beforeEach(async () => {
                await addUserToOrganizationAndValidate(
                    testClient,
                    idOfUserPerformingOperation,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                const role = await createRole(
                    testClient,
                    organizationId,
                    adminToken
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    'create_users_40220',
                    { authorization: adminToken }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    idOfUserPerformingOperation,
                    organizationId,
                    role.role_id,
                    { authorization: adminToken }
                )
            })
            it('creates users with permission', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                connection.logger.reset()
                const createUsersResult = await createUsersResolver(
                    createUserInputs,
                    nonAdminUser
                )
                const userConNodes = createUsersResult.users
                expect(connection.logger.count).to.equal(3)
                expect(userConNodes.length).to.equal(createUserInputs.length)
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers - previousUsers).to.equal(
                    createUserInputs.length
                )
            })
        })
        context(
            'when an input array member has no contact info and no username',
            () => {
                beforeEach(async () => {
                    createUserInputs[25].contactInfo = undefined
                    createUserInputs[25].username = undefined
                })
                it('it fails to create users', async () => {
                    const previousUsers = await connection
                        .getRepository(User)
                        .count()
                    try {
                        await createUsersResolver(createUserInputs, adminUser)
                        expect.fail(
                            null,
                            null,
                            'createUsers did not reject with an error'
                        )
                    } catch (e: any) {
                        const errs = e.errors
                        expect(errs).to.be.an('Array')
                        expect(errs).to.have.length(1)
                        expect(errs[0]).to.be.an('error')
                        expect(errs[0].message).to.equal(
                            'On index 25, User username/contactInfo is required.'
                        )
                    }

                    const currentUsers = await connection
                        .getRepository(User)
                        .count()
                    expect(currentUsers).to.equal(previousUsers)
                })
            }
        )
        context(
            'when an input array member has an empty contact info and no username',
            () => {
                beforeEach(async () => {
                    createUserInputs[25].contactInfo = {}
                    createUserInputs[25].username = undefined
                })
                it('it fails to create users', async () => {
                    const previousUsers = await connection
                        .getRepository(User)
                        .count()
                    await expect(
                        createUsersResolver(createUserInputs, adminUser)
                    ).to.be.rejected
                    const currentUsers = await connection
                        .getRepository(User)
                        .count()
                    expect(currentUsers).to.equal(previousUsers)
                })
            }
        )
        context(
            'when an input array member has an empty contact info but has a username',
            () => {
                beforeEach(async () => {
                    createUserInputs[25].contactInfo = {}
                    createUserInputs[25].username = faker.name.firstName()
                })
                it('it fails to create users', async () => {
                    const previousUsers = await connection
                        .getRepository(User)
                        .count()
                    await expect(
                        createUsersResolver(createUserInputs, adminUser)
                    ).to.be.rejected
                    const currentUsers = await connection
                        .getRepository(User)
                        .count()
                    expect(currentUsers).to.equal(previousUsers)
                })
            }
        )
        context(
            'when an input array member has no contact info but has a username',
            () => {
                beforeEach(async () => {
                    createUserInputs[25].contactInfo = undefined
                    createUserInputs[25].username = faker.name.firstName()
                })
                it('creates users', async () => {
                    const previousUsers = await connection
                        .getRepository(User)
                        .count()
                    const createUsersResult = await createUsersResolver(
                        createUserInputs,
                        adminUser
                    )
                    const userConNodes = createUsersResult.users
                    expect(userConNodes.length).to.equal(
                        createUserInputs.length
                    )
                    const currentUsers = await connection
                        .getRepository(User)
                        .count()
                    expect(currentUsers - previousUsers).to.equal(
                        createUserInputs.length
                    )
                })
            }
        )
        context(
            'when an input array member has contact info but has no username',
            () => {
                beforeEach(async () => {
                    createUserInputs[25].contactInfo = {
                        email: faker.internet.email(),
                    }
                    createUserInputs[25].username = undefined
                })
                it('creates users', async () => {
                    const previousUsers = await connection
                        .getRepository(User)
                        .count()
                    const createUsersResult = await createUsersResolver(
                        createUserInputs,
                        adminUser
                    )
                    const userConNodes = createUsersResult.users
                    expect(userConNodes.length).to.equal(
                        createUserInputs.length
                    )
                    const currentUsers = await connection
                        .getRepository(User)
                        .count()
                    expect(currentUsers - previousUsers).to.equal(
                        createUserInputs.length
                    )
                })
            }
        )
        context('when there are too many input array members', () => {
            beforeEach(async () => {
                createUserInputs.push(userToCreateUserInput(createUser()))
            })
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                await expect(createUsersResolver(createUserInputs, adminUser))
                    .to.be.rejected
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('when there is a validation failure', () => {
            beforeEach(async () => {
                createUserInputs[2].contactInfo = { email: 'somethinghorrid' }
            })
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                await expect(createUsersResolver(createUserInputs, adminUser))
                    .to.be.rejected
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('when there is a duplication in the input', () => {
            beforeEach(async () => {
                createUserInputs[3] = createUserInputs[2]
            })
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                const error = await expect(
                    createUsersResolver(createUserInputs, adminUser)
                ).to.be.rejected

                const expectedErrors = [
                    createDuplicateAttributeAPIError(
                        3,
                        [
                            'givenName',
                            'familyName',
                            'username',
                            'phone',
                            'email',
                        ],
                        'CreateUserInput'
                    ),
                ]

                compareMultipleErrors(error.errors, expectedErrors)

                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('when some matching records already exist on the db', () => {
            let duplicateUsers: User[]

            const createExistentError = (user: User, index: number) => {
                return createEntityAPIError(
                    'existent',
                    index,
                    'User',
                    user.user_id,
                    undefined,
                    undefined,
                    ['givenName', 'familyName', 'username']
                )
            }

            beforeEach(async () => {
                duplicateUsers = await User.save(userFactory(3))
                createUserInputs[0] = userToCreateUserInput(duplicateUsers[0])
                createUserInputs[5] = userToCreateUserInput(duplicateUsers[1])
                createUserInputs[35] = userToCreateUserInput(duplicateUsers[2])
            })

            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()

                const error = await expect(
                    createUsersResolver(createUserInputs, adminUser)
                ).to.be.rejected

                const expectedErrors = [
                    createExistentError(duplicateUsers[0], 0),
                    createExistentError(duplicateUsers[1], 5),
                    createExistentError(duplicateUsers[2], 35),
                ]

                compareMultipleErrors(error.errors, expectedErrors)

                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('when the input array is empty', () => {
            const emptyInputs: CreateUserInput[] = []
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                await expect(createUsersResolver(emptyInputs, adminUser)).to.be
                    .rejected
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('DB calls', () => {
            const getDbCallCount = async (input: CreateUserInput[]) => {
                connection.logger.reset()
                await createUsersResolver(input, adminUser)
                return connection.logger.count
            }

            const generateInputs = (quantity: number) =>
                Array.from(new Array(quantity), () => {
                    return {
                        givenName: faker.name.firstName(),
                        familyName: faker.name.lastName(),
                        gender: faker.random.arrayElement(['female', 'male']),
                        username: faker.name.firstName(),
                    }
                })

            it('db connections do not increase with number of input elements', async () => {
                await getDbCallCount(generateInputs(1)) // warm up permissions cache

                const singleCategoryCount = await getDbCallCount(
                    generateInputs(1)
                )

                const twoCategoriesCount = await getDbCallCount(
                    generateInputs(2)
                )

                expect(twoCategoriesCount).to.be.eq(singleCategoryCount)
                expect(twoCategoriesCount).to.be.equal(3)
            })
        })
        context('generateEntityMaps', () => {
            let createUsers: CreateUsers
            const generateExistingUsers = async (org: Organization) => {
                const existingUser = await createUser(org).save()
                const nonPermittedOrgUser = await createUser(
                    await createOrgFactory().save()
                ).save()

                const inactiveUser = createUser(org)
                inactiveUser.status = Status.INACTIVE
                await inactiveUser.save()

                const inactiveOrg = createOrgFactory()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()
                const inactiveOrgUser = await createUser(inactiveOrg).save()

                return [
                    existingUser,
                    nonPermittedOrgUser,
                    inactiveUser,
                    inactiveOrgUser,
                ]
            }

            beforeEach(async () => {
                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )

                createUsers = new CreateUsers([], permissions)
            })

            it('returns existing users', async () => {
                const existingUsers = await generateExistingUsers(organization1)
                const expectedPairs = await Promise.all(
                    existingUsers
                        .filter((eu) => eu.status === Status.ACTIVE)
                        .map(async (eu) => {
                            return {
                                givenName: eu.given_name!,
                                familyName: eu.family_name!,
                                username: eu.username,
                            }
                        })
                )

                const input: CreateUserInput[] = [
                    ...expectedPairs.map((ep) => {
                        return {
                            ...ep,
                            gender: 'female',
                        }
                    }),
                    {
                        givenName: 'User',
                        familyName: 'Test',
                        gender: 'male',
                        username: 'usertest',
                    },
                ]

                const entityMaps = await createUsers.generateEntityMaps(input)

                expect(
                    Array.from(entityMaps.conflictingUsers.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
            })
        })
    })

    describe('.modifyOrganizationRoles', () => {
        let organization2: Organization
        let organization3: Organization
        let user1: User
        let user2: User
        let user3: User
        let role2: Role
        let role3: Role
        let input:
            | AddOrganizationRolesToUserInput[]
            | RemoveOrganizationRolesFromUserInput[]
        let initialRoles: Role[][]

        /**
         * Use inputs to generate the roles a membership is expected to have
         * and check that it matches with what is in the databse
         */
        async function checkDbHasExpectedValues(
            modifyRolesFn: (
                currentRoles: Role[],
                idsToModify: string[]
            ) => string[]
        ) {
            const dbMemberships = await getMap.membership.organization(
                input.map((i) => i.organizationId),
                input.map((i) => i.userId),
                ['roles']
            )
            for (const [idx, val] of input.entries()) {
                const { organizationId, userId, roleIds } = val
                const dbMembership = dbMemberships.get({
                    organizationId,
                    userId,
                })
                expect(dbMembership).to.not.be.undefined
                if (dbMembership === undefined) continue

                // eslint-disable-next-line no-await-in-loop
                const dbRoleIds = (await dbMembership.roles) // already fetched
                    ?.map((r) => r.role_id)
                    .sort()
                const expectedRoleIds = modifyRolesFn(
                    initialRoles[idx],
                    roleIds
                )
                expect(expectedRoleIds).to.deep.equalInAnyOrder(dbRoleIds)
            }
        }

        beforeEach(async () => {
            ;[
                organization1,
                organization2,
                organization3,
            ] = await Organization.save(createOrganizations(3))
            ;[user1, user2, user3] = await User.save(userFactory(3))
            ;[role1, role2, role3] = await Role.save(
                ['1', '2', '3'].map((num) => roleFactory(`Role ${num}`))
            )

            input = [
                {
                    organizationId: organization1.organization_id,
                    userId: user1.user_id,
                    roleIds: [role1.role_id, role2.role_id],
                },
                {
                    organizationId: organization2.organization_id,
                    userId: user2.user_id,
                    roleIds: [role2.role_id, role3.role_id],
                },
                {
                    organizationId: organization3.organization_id,
                    userId: user3.user_id,
                    roleIds: [role3.role_id],
                },
            ]
        })

        // There is only one test specifically for .removeOrganizationRolesFromUsers, all common tests are done with .addOrganizationRolesToUsers
        context('when called by .removeOrganizationRolesFromUsers', () => {
            function removeOrgRoles(authUser = adminUser) {
                const permissions = new UserPermissions(userToPayload(authUser))
                const ctx = { permissions }
                return removeOrganizationRolesFromUsers({ input: input }, ctx)
            }

            function checkRolesRemoved() {
                return checkDbHasExpectedValues(
                    (currentRoles: Role[], roleIdsToRemove: string[]) => {
                        const expectedRolesArray = currentRoles.filter(
                            (cr) =>
                                !roleIdsToRemove.find(
                                    (rid) => cr.role_id === rid
                                )
                        )
                        return [
                            ...new Set(
                                expectedRolesArray.map((r) => r.role_id).sort()
                            ),
                        ]
                    }
                )
            }

            beforeEach(async () => {
                initialRoles = [
                    [role1, role2, role3],
                    [role2, role3],
                    [role1, role2, role3],
                ]
                await OrganizationMembership.save([
                    createOrganizationMembership({
                        user: user1,
                        organization: organization1,
                        roles: initialRoles[0],
                    }),
                    createOrganizationMembership({
                        user: user2,
                        organization: organization2,
                        roles: initialRoles[1],
                    }),
                    createOrganizationMembership({
                        user: user3,
                        organization: organization3,
                        roles: initialRoles[2],
                    }),
                ])
            })

            context('and caller has permissions to add roles to user', () => {
                context('and all attributes are valid', () => {
                    it('adds all the roles', async () => {
                        await expect(removeOrgRoles()).to.be.fulfilled
                        await checkRolesRemoved()
                    })
                })
            })
        })
    })

    describe('AddOrganizationRolesToUsers', () => {
        let org: Organization
        let orgUsers: User[]
        let orgRoles: Role[]
        let systemRoles: Role[]
        let admin: User
        const usersCount = 5
        const rolesCount = 5

        beforeEach(async () => {
            admin = await createAdminUser(testClient)
            systemRoles = await Role.find()
            org = await createOrgFactory().save()
            orgUsers = await User.save(createUsers(usersCount))
            orgRoles = await Role.save(createRoles(rolesCount, org))

            await OrganizationMembership.save(
                createOrganizationMemberships(orgUsers, org)
            )
        })

        function buildSingleInput(
            organization: Organization,
            user: User,
            roles: Role[]
        ): AddOrganizationRolesToUserInput {
            return {
                organizationId: organization.organization_id,
                userId: user.user_id,
                roleIds: roles.map((r) => r.role_id),
            }
        }

        function buildInputsForSameOrg(
            organization: Organization,
            users: User[],
            roles: Role[]
        ): AddOrganizationRolesToUserInput[] {
            return Array.from(users, (u) =>
                buildSingleInput(organization, u, roles)
            )
        }

        function buildDefaultInputs() {
            return buildInputsForSameOrg(org, orgUsers, orgRoles)
        }

        function getAddOrganizationRolesToUsers(
            input: AddOrganizationRolesToUserInput[],
            clientUser = admin
        ) {
            const permissions = new UserPermissions(userToPayload(clientUser))
            return new AddOrganizationRolesToUsers(input, permissions)
        }

        async function checkRolesAdded(
            input: AddOrganizationRolesToUserInput[]
        ) {
            const membershipRoles = await Promise.all(
                Array.from(input, (i) =>
                    OrganizationMembership.findOneOrFail({
                        where: {
                            organization_id: i.organizationId,
                            user_id: i.userId,
                            status: Status.ACTIVE,
                        },
                    }).then((m) => m.roles!)
                )
            )

            input.forEach((i, index) => {
                const roles = membershipRoles[index]
                expect(roles).to.exist
                expect(roles).to.have.lengthOf(i.roleIds.length)
                expect(roles.map((r) => r.role_id)).to.have.same.members(
                    i.roleIds
                )
            })
        }

        async function checkNoChangesMade(
            input: AddOrganizationRolesToUserInput[]
        ) {
            const membershipRoles = await Promise.all(
                Array.from(input, (i) =>
                    OrganizationMembership.findOneOrFail({
                        where: {
                            organization_id: i.organizationId,
                            user_id: i.userId,
                            status: Status.ACTIVE,
                        },
                    }).then((m) => m.roles!)
                )
            )

            input.forEach((_, index) => {
                const roles = membershipRoles[index]
                expect(roles).to.exist
                expect(roles).to.have.lengthOf(0)
            })
        }

        context('.run', () => {
            it('can add system roles to organization memberships', async () => {
                const input = buildInputsForSameOrg(org, orgUsers, systemRoles)
                await expect(getAddOrganizationRolesToUsers(input).run()).to.be
                    .fulfilled

                await checkRolesAdded(input)
            })

            it('can add organization roles to organization memberships', async () => {
                const input = buildDefaultInputs()
                await expect(getAddOrganizationRolesToUsers(input).run()).to.be
                    .fulfilled

                await checkRolesAdded(input)
            })

            it('makes the expected number of db calls', async () => {
                const input = buildDefaultInputs()
                connection.logger.reset()
                await getAddOrganizationRolesToUsers(input).run()

                expect(connection.logger.count).to.equal(
                    9,
                    'preload: 5, authorize: 1, save: 3'
                )
            })
        })

        context('.authorize', () => {
            context('when caller is admin', () => {
                it('does not raise an error', async () => {
                    const input = buildDefaultInputs()
                    const mutation = getAddOrganizationRolesToUsers(input)
                    await expect(mutation.authorize(input)).to.be.fulfilled
                })
            })

            context('when caller is not admin, but has permissions', () => {
                let userWithPermissions: User

                beforeEach(async () => {
                    const permission = PermissionName.edit_users_40330
                    const roleWithPermission = await roleFactory(
                        'Edit Users',
                        org,
                        { permissions: [permission] }
                    ).save()

                    userWithPermissions = await createUser().save()
                    await createOrganizationMembership({
                        user: userWithPermissions,
                        organization: org,
                        roles: [roleWithPermission],
                    }).save()
                })

                it('does not raise an error', async () => {
                    const input = buildDefaultInputs()
                    const mutation = getAddOrganizationRolesToUsers(
                        input,
                        userWithPermissions
                    )

                    await expect(mutation.authorize(input)).to.be.fulfilled
                })
            })

            context('when caller does not have permissions', () => {
                let userWithoutPermissions: User

                beforeEach(async () => {
                    const permission = PermissionName.create_users_40220
                    const roleWithoutPermission = await roleFactory(
                        'Create Users',
                        org,
                        { permissions: [permission] }
                    ).save()

                    userWithoutPermissions = await createUser().save()
                    await createOrganizationMembership({
                        user: userWithoutPermissions,
                        organization: org,
                        roles: [roleWithoutPermission],
                    }).save()
                })

                it('returns a permission error', async () => {
                    const input = buildDefaultInputs()
                    const mutation = getAddOrganizationRolesToUsers(
                        input,
                        userWithoutPermissions
                    )

                    await expect(mutation.authorize(input)).to.be.rejectedWith(
                        buildPermissionError(
                            PermissionName.edit_users_40330,
                            userWithoutPermissions,
                            [org]
                        )
                    )

                    await checkNoChangesMade(input)
                })
            })
        })

        context('.generateEntityMaps', () => {
            let orgMemberships: OrganizationMembership[]
            let otherOrgMemberships: OrganizationMembership[]
            let otherOrg: Organization
            let otherRoles: Role[]
            let otherUsers: User[]

            beforeEach(async () => {
                otherOrg = await createOrgFactory().save()
                otherRoles = await Role.save(createRoles(rolesCount, otherOrg))

                otherUsers = await User.save(createUsers(usersCount))
                otherOrgMemberships = await OrganizationMembership.save(
                    Array.from(otherUsers, (u, i) =>
                        createOrganizationMembership({
                            user: u,
                            organization: otherOrg,
                            roles: [otherRoles[i]],
                        })
                    )
                )

                orgMemberships = await OrganizationMembership.find({
                    where: { organization_id: org.organization_id },
                })

                orgMemberships.forEach((m, i) => {
                    m.roles = Promise.resolve([orgRoles[i]])
                })

                await OrganizationMembership.save(orgMemberships)
            })

            it('returns membership roles', async () => {
                const expectedMap = new ObjMap<
                    OrganizationMembershipKey,
                    Role[]
                >()

                const allMemberships = [
                    ...orgMemberships,
                    ...otherOrgMemberships,
                ]

                allMemberships.forEach(async (m) => {
                    const roles = await m.roles!
                    expectedMap.set(
                        {
                            organizationId: m.organization_id,
                            userId: m.user_id,
                        },
                        roles
                    )
                })

                const input = buildDefaultInputs()
                input.push(
                    ...buildInputsForSameOrg(otherOrg, otherUsers, otherRoles)
                )

                const mutation = getAddOrganizationRolesToUsers(input)
                const entityMaps = await mutation.generateEntityMaps(input)
                const membershipRoles = entityMaps.membershipRoles
                expect(membershipRoles.size).to.eq(expectedMap.size)

                Array.from(membershipRoles.keys()).forEach((k) => {
                    const mapValue = membershipRoles.get(k)
                    const expectedValue = expectedMap.get(k)

                    expect(expectedValue).to.exist
                    expect(
                        mapValue?.map((v) => v.role_id)
                    ).to.deep.equalInAnyOrder(
                        expectedValue?.map((v) => v.role_id)
                    )
                })
            })

            it('returns organization roles', async () => {
                const expectedMap = new Map<string, Role[]>()
                expectedMap.set(org.organization_id, orgRoles)
                expectedMap.set(otherOrg.organization_id, otherRoles)

                const input = buildDefaultInputs()
                input.push(
                    ...buildInputsForSameOrg(otherOrg, otherUsers, otherRoles)
                )

                const mutation = getAddOrganizationRolesToUsers(input)
                const entityMaps = await mutation.generateEntityMaps(input)
                const organizationRoles = entityMaps.orgRoles
                expect(organizationRoles.size).to.eq(expectedMap.size)

                Array.from(organizationRoles.keys()).forEach((k) => {
                    const mapValue = organizationRoles.get(k)
                    const expectedValue = expectedMap.get(k)

                    expect(expectedValue).to.exist
                    expect(
                        mapValue?.map((v) => v.role_id)
                    ).to.deep.equalInAnyOrder(
                        expectedValue?.map((v) => v.role_id)
                    )
                })
            })
        })

        context('.validateOverAllInputs', () => {
            async function validateOverAllInputs(
                input: AddOrganizationRolesToUserInput[]
            ) {
                const mutation = getAddOrganizationRolesToUsers(input)
                return mutation.validationOverAllInputs(input)
            }

            it('produces error for organizationId and userId combination duplicates', async () => {
                const input = [
                    buildSingleInput(org, orgUsers[0], [orgRoles[0]]),
                    buildSingleInput(org, orgUsers[0], [orgRoles[1]]),
                ]

                const result = await validateOverAllInputs(input)
                const expectedErrors = [
                    createDuplicateInputAttributeAPIError(
                        1,
                        'Organization',
                        org.organization_id,
                        'userId',
                        orgUsers[0].user_id
                    ),
                ]

                compareMultipleErrors(result.apiErrors, expectedErrors)
                expect(result.validInputs).to.have.lengthOf(1)
            })

            it('produces error for roleIds incorrect length', async () => {
                const input = [buildSingleInput(org, orgUsers[0], [])]

                const result = await validateOverAllInputs(input)
                const expectedErrors = [
                    createInputLengthAPIError(
                        'AddOrganizationRolesToUsersInput',
                        'min',
                        'roleIds',
                        0
                    ),
                ]

                compareMultipleErrors(result.apiErrors, expectedErrors)
                expect(result.validInputs).to.have.lengthOf(0)
            })

            it('produces error for roleIds duplicates', async () => {
                const input = [
                    buildSingleInput(org, orgUsers[0], [
                        orgRoles[0],
                        orgRoles[0],
                    ]),
                ]

                const result = await validateOverAllInputs(input)
                const expectedErrors = [
                    createDuplicateAttributeAPIError(
                        0,
                        ['roleIds'],
                        'AddOrganizationRolesToUsersInput'
                    ),
                ]

                compareMultipleErrors(result.apiErrors, expectedErrors)
                expect(result.validInputs).to.have.lengthOf(0)
            })
        })

        context('.validate', () => {
            async function validate(input: AddOrganizationRolesToUserInput[]) {
                const mutation = getAddOrganizationRolesToUsers(input, admin)
                const maps = await mutation.generateEntityMaps(input)
                return input.flatMap((i, index) =>
                    mutation.validate(
                        index,
                        maps.mainEntity.get(i.userId)!,
                        i,
                        maps
                    )
                )
            }

            it('produces error for non existent organization', async () => {
                const input = [
                    buildSingleInput(org, orgUsers[0], [orgRoles[0]]),
                ]

                const nonValidId = uuid_v4()
                input[0].organizationId = nonValidId

                const result = await validate(input)
                const expectedErrors = [
                    createEntityAPIError(
                        'nonExistent',
                        0,
                        'Organization',
                        nonValidId
                    ),
                ]

                compareMultipleErrors(result, expectedErrors)
            })

            it('produces error for non existent user', async () => {
                const input = [
                    buildSingleInput(org, orgUsers[0], [orgRoles[0]]),
                ]

                const nonValidId = uuid_v4()
                input[0].userId = nonValidId

                const result = await validate(input)
                const expectedErrors = [
                    createEntityAPIError('nonExistent', 0, 'User', nonValidId),
                ]

                compareMultipleErrors(result, expectedErrors)
            })

            it('produces error for non existent role', async () => {
                const input = [
                    buildSingleInput(org, orgUsers[0], [orgRoles[0]]),
                ]

                const nonValidId = uuid_v4()
                input[0].roleIds = [nonValidId]

                const result = await validate(input)
                const expectedErrors = [
                    createEntityAPIError('nonExistent', 0, 'Role', nonValidId),
                ]

                compareMultipleErrors(result, expectedErrors)
            })

            context(
                'when the given user is not member of the given organization',
                () => {
                    let otherUser: User

                    beforeEach(async () => {
                        otherUser = await createUser().save()
                    })

                    it('produces error for non existent organization membership', async () => {
                        const input = [
                            buildSingleInput(org, otherUser, [orgRoles[0]]),
                        ]

                        const result = await validate(input)
                        const expectedErrors = [
                            createEntityAPIError(
                                'nonExistentChild',
                                0,
                                'User',
                                otherUser.user_id,
                                'Organization',
                                org.organization_id
                            ),
                        ]

                        compareMultipleErrors(result, expectedErrors)
                    })
                }
            )

            context(
                'when one of the given roles does not belongs to the given organization and this role is not system',
                () => {
                    let otherRole: Role

                    beforeEach(async () => {
                        const otherOrg = await createOrgFactory().save()
                        otherRole = await roleFactory(
                            undefined,
                            otherOrg
                        ).save()
                    })

                    it('produces error for non existent role in the given organization', async () => {
                        const input = [
                            buildSingleInput(org, orgUsers[0], [otherRole]),
                        ]

                        const result = await validate(input)
                        const expectedErrors = [
                            createEntityAPIError(
                                'nonExistentChild',
                                0,
                                'Role',
                                otherRole.role_id,
                                'Organization',
                                org.organization_id
                            ),
                        ]

                        compareMultipleErrors(result, expectedErrors)
                    })
                }
            )

            context(
                'when the given role was already added for the given user in the given organization',
                () => {
                    beforeEach(async () => {
                        const membership = await OrganizationMembership.findOneOrFail(
                            {
                                where: {
                                    organization_id: org.organization_id,
                                    user_id: orgUsers[0].user_id,
                                },
                            }
                        )

                        membership.roles = Promise.resolve([orgRoles[0]])
                        await membership.save()
                    })

                    it('produces error for already added role in the given organization membership', async () => {
                        const input = [
                            buildSingleInput(org, orgUsers[0], [orgRoles[0]]),
                        ]

                        const result = await validate(input)
                        const expectedErrors = [
                            createEntityAPIError(
                                'existentChild',
                                0,
                                'Role',
                                orgRoles[0].role_id,
                                'Organization',
                                org.organization_id
                            ),
                        ]

                        compareMultipleErrors(result, expectedErrors)
                    })
                }
            )
        })
    })

    describe('AddSchoolRolesToUsers', () => {
        let input: AddSchoolRolesToUserInput[]
        let org: Organization
        let users: User[]
        let roles: Role[]
        let systemRole: Role
        let schools: School[]
        let memberships: SchoolMembership[]

        function getAddRoles(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return new AddSchoolRolesToUsers([], permissions)
        }

        async function inactivateMembership(
            school_id: string,
            user_id: string
        ) {
            const membership = await SchoolMembership.findOneOrFail({
                where: { school_id, user_id },
            })
            await membership.inactivate(getManager())
        }

        beforeEach(async () => {
            org = await organizationFactory().save()
            schools = createSchools(3, org)
            await School.save(schools)
            users = userFactory(3)
            roles = createRoles(3)
            roles.forEach((r) => (r.organization = Promise.resolve(org)))
            systemRole = roleFactory(undefined, undefined, undefined, true)
            await connection.manager.save([...users, ...roles, systemRole])

            memberships = users.map((user, index) =>
                createSchoolMembership({
                    user,
                    school: schools[index],
                })
            )
            await SchoolMembership.save(memberships)

            // Generate input
            input = []
            const inputRoleIndices = [
                [0, 1],
                [1, 2],
                [0, 1, 2],
            ]
            for (let i = 0; i < 3; i++) {
                input.push({
                    userId: users[i].user_id,
                    schoolId: schools[i].school_id,
                    roleIds: inputRoleIndices[i].map((rr) => roles[rr].role_id),
                })
            }
            input[2].roleIds.push(systemRole.role_id)
        })

        context('.run', () => {
            it('returns the expected output', async () => {
                input = [
                    {
                        userId: users[0].user_id,
                        schoolId: schools[0].school_id,
                        roleIds: [roles[0].role_id],
                    },
                ]

                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutationResult = mutate(
                    AddSchoolRolesToUsers,
                    { input },
                    permissions
                )

                const { users: usersNodes }: UsersMutationResult = await expect(
                    mutationResult
                ).to.be.fulfilled
                expect(usersNodes).to.have.length(1)
                expect(usersNodes[0]).to.deep.eq(
                    mapUserToUserConnectionNode(users[0])
                )
                const dbRoles = await memberships[0].roles!
                expect(dbRoles).to.have.length(1)
                expect(mapRoleToRoleConnectionNode(dbRoles[0])).to.deep.eq(
                    mapRoleToRoleConnectionNode(roles[0])
                )
            })
        })

        context('.generateEntityMaps', () => {
            it('makes constant number of queries regardless of input length', async () => {
                const mutation = getAddRoles()
                connection.logger.reset()
                await mutation.generateEntityMaps([input[0]])
                const countForOneInput = connection.logger.count
                connection.logger.reset()
                await mutation.generateEntityMaps(input)
                const countForTwo = connection.logger.count
                expect(countForTwo).to.eq(8)
                expect(countForTwo).to.eq(countForOneInput)
            })

            context('populates the maps correctly', () => {
                let maps: AddSchoolRolesToUsersEntityMap

                beforeEach(async () => {
                    // add existing roles to membership
                    // to test membershipRoles map
                    memberships[0].roles = Promise.resolve([
                        systemRole,
                        roles[0],
                    ])
                    await memberships[0].save()

                    const permissions = new UserPermissions(
                        userToPayload(adminUser)
                    )

                    const mutation = new AddSchoolRolesToUsers(
                        input,
                        permissions
                    )
                    maps = await mutation.generateEntityMaps(input)
                })

                it('populates mainEntity correctly', () => {
                    expect(
                        Array.from(
                            maps.mainEntity.entries()
                        ).map(([id, user]) => [id, user.user_id])
                    ).to.deep.equalInAnyOrder(
                        users.map((u) => [u.user_id, u.user_id])
                    )
                })

                it('populates membership roles correctly', async () => {
                    const membershipRoles = []

                    for (const membership of memberships) {
                        membershipRoles.push([
                            {
                                userId: membership.user_id,
                                schoolId: membership.school_id,
                            },
                            (await membership.roles)!.map((r) => r.role_id),
                        ])
                    }

                    expect(
                        Array.from(
                            maps.membershipRoles.entries()
                        ).map(([id, entity]) => [
                            id,
                            entity.map((e) => e.role_id),
                        ])
                    ).to.deep.equalInAnyOrder(membershipRoles)
                })

                it('populates memberships correctly', () => {
                    const expectedMembershipIds = memberships
                        .map((m) => {
                            return {
                                userId: m.user_id,
                                schoolId: m.school_id,
                            }
                        })
                        .map((membershipId) => [membershipId, membershipId])

                    expect(
                        Array.from(maps.memberships.entries()).map(
                            ([id, entity]) => [
                                id,
                                {
                                    userId: entity.user_id,
                                    schoolId: entity.school_id,
                                },
                            ]
                        )
                    ).to.deep.equalInAnyOrder(expectedMembershipIds)
                })

                it('populates schoolOrg correclty', async () => {
                    const schoolOrgs = []

                    for (const school of schools) {
                        schoolOrgs.push([
                            school.school_id,
                            (await school.organization)!.organization_id,
                        ])
                    }

                    expect(
                        Array.from(
                            maps.schoolOrg.entries()
                        ).map(([id, entity]) => [id, entity.organization_id])
                    ).to.deep.equalInAnyOrder(schoolOrgs)
                })

                it('populates schools correctly', () => {
                    expect(
                        Array.from(
                            maps.schools.entries()
                        ).map(([id, school]) => [id, school.school_id])
                    ).to.deep.equalInAnyOrder(
                        schools.map((s) => [s.school_id, s.school_id])
                    )
                })

                it('popualtes orgRoles correctly', () => {
                    expect(
                        Array.from(
                            maps.orgRoles.entries()
                        ).map(([id, roles]) => [
                            id,
                            roles.map((r) => r.role_id),
                        ])
                    ).to.deep.equalInAnyOrder([
                        [org.organization_id, roles.map((r) => r.role_id)],
                    ])
                })

                it('populates roles correctly', () => {
                    expect(
                        Array.from(maps.roles.entries()).map(([id, role]) => [
                            id,
                            role.role_id,
                        ])
                    ).to.deep.equalInAnyOrder(
                        [...roles, systemRole].map((r) => [
                            r.role_id,
                            r.role_id,
                        ])
                    )
                })
            })
        })

        context('.authorize', () => {
            async function authorize(authUser = adminUser) {
                const mutation = getAddRoles(authUser)
                const maps = await mutation.generateEntityMaps(input)
                return mutation.authorize(input, maps)
            }

            const permission = PermissionName.edit_users_40330
            context(
                'when user has permissions to remove users from all schools',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await roleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createOrganizationMembership({
                            user: nonAdminUser,
                            organization: org,
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('completes successfully', async () => {
                        await expect(authorize(nonAdminUser)).to.be.fulfilled
                    })
                }
            )

            context(
                'when user does not have permissions to remove users from all schools',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await roleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createSchoolMembership({
                            user: nonAdminUser,
                            school: schools[1],
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('returns a permission error', async () => {
                        await expect(
                            authorize(nonAdminUser)
                        ).to.be.rejectedWith(
                            buildPermissionError(
                                permission,
                                nonAdminUser,
                                [org],
                                [schools[0], schools[2]]
                            )
                        )
                    })
                }
            )
        })

        context('.validationOverAllInputs', () => {
            context('when the same membership is used three times', () => {
                beforeEach(() => {
                    input = [input[0], input[0], input[0]]
                })

                it('returns duplicate errors for the last two memberships', () => {
                    const val = getAddRoles().validationOverAllInputs(input)
                    const expectedErrors = [1, 2].map((inputIndex) =>
                        createDuplicateInputAttributeAPIError(
                            inputIndex,
                            'School',
                            input[0].schoolId,
                            'user_id',
                            input[0].userId
                        )
                    )
                    compareMultipleErrors(val.apiErrors, expectedErrors)
                })

                it('returns only the first input', () => {
                    const val = getAddRoles().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(0)
                    expect(val.validInputs[0].input).to.deep.equal(input[0])
                })
            })

            context(
                'when there are duplicate users and orgs but unique combinations thereof',
                () => {
                    beforeEach(() => {
                        const roleIds = roles.map((r) => r.role_id)
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                userId: users[0].user_id,
                                roleIds,
                            },
                            {
                                schoolId: schools[1].school_id,
                                userId: users[0].user_id,
                                roleIds,
                            },
                            {
                                schoolId: schools[0].school_id,
                                userId: users[1].user_id,
                                roleIds,
                            },
                        ]
                    })

                    it('returns no errors', () => {
                        const val = getAddRoles().validationOverAllInputs(input)
                        expect(val.apiErrors).to.be.empty
                        expect(
                            val.validInputs.map((vi) => vi.input)
                        ).to.deep.equal(input)
                    })

                    it('returns the full input list', () => {
                        const val = getAddRoles().validationOverAllInputs(input)
                        expect(
                            val.validInputs.map((vi) => vi.input)
                        ).to.deep.equal(input)
                    })
                }
            )

            context('when there are too many roleIds', () => {
                beforeEach(async () => {
                    const tooManyRoles = createRoles(
                        config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                    )
                    await Role.save(tooManyRoles)
                    input[0].roleIds = tooManyRoles.map((role) => role.role_id)
                    input[2].roleIds = tooManyRoles.map((role) => role.role_id)
                })

                it('returns an error', async () => {
                    const val = getAddRoles().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(1)
                    expect(val.validInputs[0].input).to.deep.equal(input[1])
                    const xErrors = [0, 2].map((i) =>
                        createInputLengthAPIError(
                            'AddSchoolRolesToUsersInput',
                            'max',
                            'roleIds',
                            i
                        )
                    )
                    compareMultipleErrors(val.apiErrors, xErrors)
                })
            })

            context(
                'when there are duplicated roleIds in a single input elemnet',
                () => {
                    beforeEach(async () => {
                        input[0].roleIds = [
                            input[0].roleIds[0],
                            input[0].roleIds[0],
                        ]
                        input[2].roleIds = [
                            input[2].roleIds[0],
                            input[2].roleIds[0],
                        ]
                    })

                    it('returns an error', async () => {
                        const val = getAddRoles().validationOverAllInputs(input)
                        expect(val.validInputs).to.have.length(1)
                        expect(val.validInputs[0].index).to.equal(1)
                        expect(val.validInputs[0].input).to.deep.equal(input[1])
                        const xErrors = [0, 2].map((i) =>
                            createDuplicateAttributeAPIError(
                                i,
                                ['roleIds'],
                                'AddSchoolRolesToUsersInput'
                            )
                        )
                        compareMultipleErrors(val.apiErrors, xErrors)
                    })
                }
            )
        })

        context('.validate', () => {
            async function validate(mutationInput: AddSchoolRolesToUserInput) {
                const mutation = getAddRoles()
                const maps = await mutation.generateEntityMaps([mutationInput])
                return mutation.validate(0, undefined, mutationInput, maps)
            }

            it('returns no errors when all inputs are valid', async () => {
                const apiErrors = await validate(input[0])
                expect(apiErrors).to.be.length(0)
            })

            context('when a user is not a member the school', () => {
                beforeEach(async () => {
                    await inactivateMembership(
                        schools[0].school_id,
                        users[0].user_id
                    )
                })

                it('returns a nonexistent_child error', async () => {
                    const apiErrors = await validate(input[0])
                    const expectedError = createEntityAPIError(
                        'nonExistentChild',
                        0,
                        'User',
                        users[0].user_id,
                        'School',
                        schools[0].school_id
                    )
                    expect(apiErrors).to.be.length(1)
                    compareErrors(apiErrors[0], expectedError)
                })
            })

            context('when one of the schools is inactive', async () => {
                beforeEach(async () => {
                    await schools[1].inactivate(getManager())
                })

                it('returns a nonexistent_entity error', async () => {
                    const errors = await validate(input[1])
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'School',
                            schools[1].school_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when one of the roles is inactive', async () => {
                beforeEach(() => roles[1].inactivate(getManager()))

                it('returns nonexistent_entity error', async () => {
                    const errors = await validate(input[0])
                    const xErrors = [0].map((index) =>
                        createEntityAPIError(
                            'nonExistent',
                            index,
                            'Role',
                            roles[1].role_id
                        )
                    )
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        schools[1].inactivate(getManager()),
                        users[1].inactivate(getManager()),
                        roles[1].inactivate(getManager()),
                        memberships[1].inactivate(getManager()),
                    ])
                })

                it('returns several nonexistent_entity errors', async () => {
                    const errors = await validate(input[1])
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'School',
                            schools[1].school_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'User',
                            users[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'Role',
                            roles[1].role_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })
        })

        context('.process', () => {
            async function process(mutationInput: AddSchoolRolesToUserInput) {
                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )
                const mutation = new AddSchoolRolesToUsers(
                    [mutationInput],
                    permissions
                )
                const maps = await mutation.generateEntityMaps([mutationInput])
                return {
                    mutationResult: mutation.process(mutationInput, maps, 0),
                    originalUser: maps.mainEntity.get(mutationInput.userId)!,
                    originalRoles: maps.membershipRoles.get({
                        schoolId: mutationInput.schoolId,
                        userId: mutationInput.userId,
                    }),
                }
            }

            it('includes existing roles', async () => {
                memberships[0].roles = Promise.resolve([roles[0], systemRole])
                await memberships[0].save()
                input[0].roleIds = []

                const {
                    mutationResult: { outputEntity, modifiedEntity },
                    originalUser,
                    originalRoles,
                } = await process(input[0])
                expect(originalUser).to.deep.eq(outputEntity)
                expect(originalRoles).to.deep.equalInAnyOrder(
                    await modifiedEntity[0].roles
                )
            })

            it('adds new roles', async () => {
                memberships[0].roles = Promise.resolve([roles[0], systemRole])
                await memberships[0].save()
                const newRoles = [roles[1], roles[2]]
                input[0].roleIds = newRoles.map((r) => r.role_id)

                const {
                    mutationResult: { outputEntity, modifiedEntity },
                    originalUser,
                    originalRoles,
                } = await process(input[0])
                expect(originalUser).to.deep.eq(outputEntity)
                expect(
                    [...originalRoles!, ...newRoles].map((r) => r.role_id)
                ).to.deep.equalInAnyOrder(
                    (await modifiedEntity[0].roles!).map((r) => r.role_id)
                )
            })
        })

        context('.applyToDatabase', () => {
            it('adds roles to the membership', async () => {
                const mutation = getAddRoles()
                memberships[0].roles = Promise.resolve(roles)
                await memberships[0].save()
                await mutation.applyToDatabase([
                    { modifiedEntity: [memberships[0]] },
                ])
                const dbMembership = (
                    await SchoolMembership.find({
                        user_id: memberships[0].user_id,
                        school_id: memberships[0].school_id,
                    })
                )[0]
                const dbMembershipRoles = await dbMembership.roles
                expect(
                    dbMembershipRoles?.map((r) =>
                        mapRoleToRoleConnectionNode(r)
                    )
                ).to.deep.equalInAnyOrder(
                    roles?.map((r) => mapRoleToRoleConnectionNode(r))
                )
            })
            it('makes constant number of queries', async () => {
                const mutation = getAddRoles()
                const existingRoles = await memberships[0].roles!
                memberships[0].roles = Promise.resolve(existingRoles.slice(1))
                memberships[0].roles = Promise.resolve([
                    existingRoles[0],
                    existingRoles[2],
                ])
                connection.logger.reset()
                await mutation.applyToDatabase([
                    { modifiedEntity: [memberships[0]] },
                ])
                const countWithOneInput = connection.logger.count
                connection.logger.reset()
                await mutation.applyToDatabase([
                    { modifiedEntity: [memberships[0]] },
                    { modifiedEntity: [memberships[1]] },
                    { modifiedEntity: [memberships[1]] },
                ])
                const countWithThreeInputs = connection.logger.count
                expect(countWithThreeInputs).to.eq(2)
                expect(countWithThreeInputs).to.eq(countWithOneInput)
            })
        })
    })

    /**
     * Some of the methods of RemoveSchoolRolesFromUsers are not tested here.
     *
     * generateEntityMaps: would repeat tests for the `getMap()`, also other tests are
     * dependent on this and would fail if the maps where wrong
     *
     * process: tested indirectly with `run()`
     *
     * applyToDatabase: tested indirectly with `run()`
     */
    describe('RemoveSchoolRolesFromUsers', () => {
        let input: RemoveSchoolRolesFromUserInput[]
        let org: Organization
        let users: User[]
        let roles: Role[]
        let schools: School[]
        let memberships: SchoolMembership[]
        let initialRoles: Role[][]

        function getRemoveRoles(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return new RemoveSchoolRolesFromUsers([], permissions)
        }

        function getMaps(
            mutation: RemoveSchoolRolesFromUsers,
            mutationInput: RemoveSchoolRolesFromUserInput[]
        ) {
            return mutation.generateEntityMaps(mutationInput)
        }

        async function checkHasExpectedRoles(
            modifyRolesFn: (
                currentRoles: Role[],
                roleIds: string[]
            ) => string[],
            mutationInput: RemoveSchoolRolesFromUserInput[]
        ) {
            const allUserIds = mutationInput.map((i) => i.userId)
            const allSchoolIds = mutationInput.map((i) => i.schoolId)
            const membershipsMap = await getMap.membership.school(
                allSchoolIds,
                allUserIds
            )
            for (const [idx, i] of mutationInput.entries()) {
                const { schoolId, userId, roleIds } = i
                const dbMembership = membershipsMap.get({ schoolId, userId })
                // Check that roles match
                const dbMembershipRoleIds =
                    // eslint-disable-next-line no-await-in-loop
                    (await dbMembership?.roles) // already fetched
                        ?.map((r) => r.role_id)
                        .sort() || []
                const expectedRoleIds = modifyRolesFn(
                    initialRoles[idx],
                    roleIds
                ).sort()
                expect(dbMembershipRoleIds).to.deep.equal(expectedRoleIds)
            }
        }

        function checkChangesMade(
            mutationInput: RemoveSchoolRolesFromUserInput[]
        ) {
            const fn = (currentRoles: Role[], roleIds: string[]) =>
                currentRoles
                    .filter((ir) => !roleIds.find((rid) => ir.role_id === rid))
                    .map((cr) => cr.role_id)
            return checkHasExpectedRoles(fn, mutationInput)
        }

        function checkNoChangesMade(
            mutationInput: RemoveSchoolRolesFromUserInput[]
        ) {
            const fn = (currentRoles: Role[]) =>
                currentRoles.map((cr) => cr.role_id)
            return checkHasExpectedRoles(fn, mutationInput)
        }

        async function inactivateMembership(
            school_id: string,
            user_id: string
        ) {
            const membership = await SchoolMembership.findOneOrFail({
                where: { school_id, user_id },
            })
            await membership.inactivate(getManager())
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            org = await organizationFactory().save()
            schools = createSchools(3, org)
            await School.save(schools)
            users = userFactory(3)
            roles = createRoles(3)
            await connection.manager.save([...users, ...roles])

            // Create memberships
            initialRoles = [roles, roles, roles]
            memberships = initialRoles.map((ir, i) =>
                createSchoolMembership({
                    user: users[i],
                    school: schools[i],
                    roles: ir,
                })
            )
            await SchoolMembership.save(memberships)

            // Generate input
            input = []
            const inputRoleIndices = [
                [0, 1],
                [1, 2],
                [0, 1, 2],
            ]
            for (let i = 0; i < 3; i++) {
                input.push({
                    userId: users[i].user_id,
                    schoolId: schools[i].school_id,
                    roleIds: inputRoleIndices[i].map((rr) => roles[rr].role_id),
                })
            }
        })

        context('.run', () => {
            function runRemoveRoles(
                mutationInput: RemoveSchoolRolesFromUserInput[],
                authUser = adminUser
            ) {
                const permissions = new UserPermissions(userToPayload(authUser))
                return mutate(
                    RemoveSchoolRolesFromUsers,
                    { input: mutationInput },
                    permissions
                )
            }

            context('when all attributes are valid', () => {
                it('removes all the users', async () => {
                    await expect(runRemoveRoles(input)).to.be.fulfilled
                    await checkChangesMade(input)
                })

                it('returns the expected output', async () => {
                    const res: UsersMutationResult = await expect(
                        runRemoveRoles(input)
                    ).to.be.fulfilled
                    const userIds = new Set(res.users.map((u) => u.id))
                    expect(userIds).to.have.length(input.length)
                    input.forEach(
                        (i) => expect(userIds.has(i.userId)).to.be.true
                    )
                })

                it('makes the expected number of database calls', async () => {
                    connection.logger.reset()
                    await expect(runRemoveRoles(input)).to.be.fulfilled
                    expect(connection.logger.count).to.equal(8) // preload: 2, authorize: 1, save: 5
                })
            })
        })

        context('.authorize', () => {
            async function authorize(authUser = adminUser) {
                const mutation = getRemoveRoles(authUser)
                const maps = await getMaps(mutation, input)
                return mutation.authorize(input, maps)
            }

            const permission = PermissionName.edit_users_40330
            context(
                'when user has permissions to remove users from all schools',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await roleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createOrganizationMembership({
                            user: nonAdminUser,
                            organization: org,
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('completes successfully', async () => {
                        await expect(authorize(nonAdminUser)).to.be.fulfilled
                    })
                }
            )

            context(
                'when user does not have permissions to remove users from all schools',
                () => {
                    beforeEach(async () => {
                        const nonAdminRole = await roleFactory(
                            'Non Admin Role',
                            org,
                            { permissions: [permission] }
                        ).save()
                        await createSchoolMembership({
                            user: nonAdminUser,
                            school: schools[1],
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('returns a permission error', async () => {
                        await expect(
                            authorize(nonAdminUser)
                        ).to.be.rejectedWith(
                            buildPermissionError(
                                permission,
                                nonAdminUser,
                                [org],
                                [schools[0], schools[2]]
                            )
                        )
                        await checkNoChangesMade(input)
                    })
                }
            )
        })

        context('.validationOverAllInputs', () => {
            context('when the same membership is used three times', () => {
                let schoolId: string
                let userId: string
                beforeEach(() => {
                    schoolId = schools[0].school_id
                    userId = users[0].user_id
                    const roleIds = roles.map((r) => r.role_id)
                    input = Array(3)
                        .fill(undefined)
                        .map(() => {
                            return { userId, schoolId, roleIds }
                        })
                })

                it('returns duplicate errors for the last two memberships', () => {
                    const val = getRemoveRoles().validationOverAllInputs(input)
                    const xErrors = [1, 2].map((i) =>
                        createDuplicateInputAttributeAPIError(
                            i,
                            'School',
                            schoolId,
                            'user_id',
                            userId
                        )
                    )
                    compareMultipleErrors(val.apiErrors, xErrors)
                })

                it('returns only the first input', () => {
                    const val = getRemoveRoles().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(0)
                    expect(val.validInputs[0].input).to.deep.equal(input[0])
                })
            })

            context(
                'when there are duplicate users and orgs but unique combinations thereof',
                () => {
                    beforeEach(() => {
                        const roleIds = roles.map((r) => r.role_id)
                        input = [
                            {
                                schoolId: schools[0].school_id,
                                userId: users[0].user_id,
                                roleIds,
                            },
                            {
                                schoolId: schools[1].school_id,
                                userId: users[0].user_id,
                                roleIds,
                            },
                            {
                                schoolId: schools[0].school_id,
                                userId: users[1].user_id,
                                roleIds,
                            },
                        ]
                    })

                    it('returns no errors', () => {
                        const val = getRemoveRoles().validationOverAllInputs(
                            input
                        )
                        expect(val.apiErrors).to.be.empty
                        expect(
                            val.validInputs.map((vi) => vi.input)
                        ).to.deep.equal(input)
                    })

                    it('returns the full input list', () => {
                        const val = getRemoveRoles().validationOverAllInputs(
                            input
                        )
                        expect(
                            val.validInputs.map((vi) => vi.input)
                        ).to.deep.equal(input)
                    })
                }
            )

            context('when there are too many roleIds', () => {
                beforeEach(async () => {
                    const tooManyRoles = createRoles(
                        config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE + 1
                    )
                    await Role.save(tooManyRoles)
                    input[0].roleIds = tooManyRoles.map((role) => role.role_id)
                    input[2].roleIds = tooManyRoles.map((role) => role.role_id)
                })

                it('returns an error', async () => {
                    const val = getRemoveRoles().validationOverAllInputs(input)
                    expect(val.validInputs).to.have.length(1)
                    expect(val.validInputs[0].index).to.equal(1)
                    expect(val.validInputs[0].input).to.deep.equal(input[1])
                    const xErrors = [0, 2].map((i) =>
                        createInputLengthAPIError(
                            'RemoveSchoolRolesFromUserInput',
                            'max',
                            'roleIds',
                            i
                        )
                    )
                    compareMultipleErrors(val.apiErrors, xErrors)
                })
            })

            context(
                'when there are duplicated roleIds in a single input elemnet',
                () => {
                    beforeEach(async () => {
                        input[0].roleIds = [
                            input[0].roleIds[0],
                            input[0].roleIds[0],
                        ]
                        input[2].roleIds = [
                            input[2].roleIds[0],
                            input[2].roleIds[0],
                        ]
                    })

                    it('returns an error', async () => {
                        const val = getRemoveRoles().validationOverAllInputs(
                            input
                        )
                        expect(val.validInputs).to.have.length(1)
                        expect(val.validInputs[0].index).to.equal(1)
                        expect(val.validInputs[0].input).to.deep.equal(input[1])
                        const xErrors = [0, 2].map((i) =>
                            createDuplicateAttributeAPIError(
                                i,
                                ['roleIds'],
                                'RemoveSchoolRolesFromUserInput'
                            )
                        )
                        compareMultipleErrors(val.apiErrors, xErrors)
                    })
                }
            )
        })

        context('.validate', () => {
            async function validate(
                mutationInput: RemoveSchoolRolesFromUserInput[]
            ) {
                const mutation = getRemoveRoles()
                const maps = await getMaps(mutation, mutationInput)
                return mutationInput.flatMap((i, index) =>
                    mutation.validate(index, undefined, i, maps)
                )
            }

            context('when all attributes are valid', () => {
                it('does not throw errors', async () => {
                    await expect(validate(input)).to.be.fulfilled
                })
            })

            context('when one of the roles was already removed', () => {
                beforeEach(async () => {
                    memberships[0].roles = Promise.resolve(
                        (await memberships[0].roles)!.slice(1)
                    )
                    await memberships[0].save()
                })

                it('returns a nonexistent_child error', async () => {
                    const errors = await validate(input)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistentChild',
                            0,
                            'Role',
                            roles[0].role_id,
                            'School',
                            schools[0].school_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when user is not a member of the school', async () => {
                beforeEach(async () => {
                    await inactivateMembership(
                        schools[0].school_id,
                        users[0].user_id
                    )
                })

                it('returns a nonexistent_child error', async () => {
                    const errors = await validate(input)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistentChild',
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

            context('when one of the schools is inactive', async () => {
                beforeEach(async () => {
                    await schools[1].inactivate(getManager())
                    initialRoles = [roles, [], roles] // membership is also inactivated
                })

                it('returns a nonexistent_entity error', async () => {
                    const errors = await validate(input)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            1,
                            'School',
                            schools[1].school_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                    await checkNoChangesMade(input)
                })
            })

            context('when one of the roles is inactive', async () => {
                beforeEach(() => roles[1].inactivate(getManager()))

                it('returns nonexistent_entity error', async () => {
                    const errors = await validate(input)
                    const xErrors = [0, 1, 2].map((index) =>
                        createEntityAPIError(
                            'nonExistent',
                            index,
                            'Role',
                            roles[1].role_id
                        )
                    )
                    compareMultipleErrors(errors, xErrors)
                    await checkNoChangesMade(input)
                })
            })

            context('when one of each attribute is inactive', async () => {
                beforeEach(async () => {
                    await Promise.all([
                        schools[2].inactivate(getManager()),
                        users[1].inactivate(getManager()),
                        roles[1].inactivate(getManager()),
                        memberships[1].inactivate(getManager()),
                    ])
                    initialRoles = [roles, [], []]
                })

                it('returns several nonexistent_entity errors', async () => {
                    const errors = await validate(input)
                    const xErrors = [
                        createEntityAPIError(
                            'nonExistent',
                            0,
                            'Role',
                            roles[1].role_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            1,
                            'User',
                            users[1].user_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            1,
                            'Role',
                            roles[1].role_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            2,
                            'School',
                            schools[2].school_id
                        ),
                        createEntityAPIError(
                            'nonExistent',
                            2,
                            'Role',
                            roles[1].role_id
                        ),
                    ]
                    compareMultipleErrors(errors, xErrors)
                    await checkNoChangesMade(input)
                })
            })
        })
    })

    describe('UpdateUsers', () => {
        let idOfUserPerformingOperation: string
        let userPerformingOperation: User
        let organizationId: string
        let arbitraryUserToken: string
        let updateUserInputs: UpdateUserInput[]
        let adminToken: string
        beforeEach(async () => {
            userPerformingOperation = await createNonAdminUser(testClient)
            idOfUserPerformingOperation = userPerformingOperation.user_id
            arbitraryUserToken = getNonAdminAuthToken()
            const orgOwner = await createAdminUser(testClient)
            adminToken = getAdminAuthToken()
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
                )
            ).organization_id

            updateUserInputs = []
            const users = await User.save(
                userFactory(config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE)
            )
            for (
                let i = 0;
                i < config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE;
                i++
            ) {
                const u = users[i]
                updateUserInputs.push(
                    randomChangeToUpdateUserInput(userToUpdateUserInput(u))
                )
            }
        })

        function updateUsersResolver(input: UpdateUserInput[], user: User) {
            return mutate(
                UpdateUsers,
                { input },
                new UserPermissions({
                    id: user.user_id,
                    email: user.email,
                    phone: user.phone,
                })
            )
        }

        context('when not authorized', () => {
            it('it fails to update users', async () => {
                await expect(
                    updateUsersResolver(
                        updateUserInputs,
                        userPerformingOperation
                    )
                ).to.be.rejectedWith(
                    `User(${userPerformingOperation.user_id}) does not have Permission(edit_users_40330)`
                )
            })
        })
        context('when admin', () => {
            it('updates users', async () => {
                const updateUserResult = await updateUsersResolver(
                    updateUserInputs,
                    adminUser
                )

                const userConNodes = updateUserResult.users
                expect(userConNodes.length).to.equal(updateUserInputs.length)
                const userIds = updateUserInputs.map((uui) => uui.id)
                const currentUsers = await connection.manager
                    .createQueryBuilder(User, 'User')
                    .where('User.user_id IN (:...ids)', { ids: userIds })
                    .getMany()
                const currentUserNodes: UserConnectionNode[] = []
                currentUsers.map((u) =>
                    currentUserNodes.push(
                        mapUserToUserConnectionNode(u) as UserConnectionNode
                    )
                )
                userConNodes.sort((a, b) =>
                    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
                )
                currentUserNodes.sort((a, b) =>
                    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
                )
                expect(currentUserNodes).to.deep.equal(userConNodes)
            })
        })

        context('when user has permission', () => {
            beforeEach(async () => {
                await addUserToOrganizationAndValidate(
                    testClient,
                    idOfUserPerformingOperation,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                const role = await createRole(
                    testClient,
                    organizationId,
                    adminToken
                )
                await grantPermission(
                    testClient,
                    role.role_id,
                    'edit_users_40330',
                    { authorization: adminToken }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    idOfUserPerformingOperation,
                    organizationId,
                    role.role_id,
                    { authorization: adminToken }
                )
            })
            it('updates users', async () => {
                connection.logger.reset()
                const updateUserResult = await updateUsersResolver(
                    updateUserInputs,
                    userPerformingOperation
                )

                const userConNodes = updateUserResult.users
                expect(userConNodes.length).to.equal(updateUserInputs.length)
                expect(connection.logger.count).to.equal(54)
                const userIds = updateUserInputs.map((uui) => uui.id)
                const currentUsers = await connection.manager
                    .createQueryBuilder(User, 'User')
                    .where('User.user_id IN (:...ids)', { ids: userIds })
                    .getMany()
                const currentUserNodes: UserConnectionNode[] = []

                currentUsers.map((u) =>
                    currentUserNodes.push(
                        mapUserToUserConnectionNode(u) as UserConnectionNode
                    )
                )
                userConNodes.sort((a, b) =>
                    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
                )
                currentUserNodes.sort((a, b) =>
                    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
                )
                expect(currentUserNodes).to.deep.equal(userConNodes)
            })
            it('updates users avatars', async () => {
                connection.logger.reset()
                for (const u of updateUserInputs) {
                    u.avatar = faker.internet.url()
                }
                const updateUserResult = await updateUsersResolver(
                    updateUserInputs,
                    userPerformingOperation
                )

                const inputAvatars = updateUserInputs.map((a) => a.avatar)
                const userConNodes = updateUserResult.users
                const outputAvatars = userConNodes.map((a) => a.avatar)
                expect(userConNodes.length).to.equal(updateUserInputs.length)
                expect(connection.logger.count).to.equal(54)
                const userIds = updateUserInputs.map((uui) => uui.id)
                const currentUsers = await connection.manager
                    .createQueryBuilder(User, 'User')
                    .where('User.user_id IN (:...ids)', { ids: userIds })
                    .getMany()
                const dbAvatars = currentUsers.map((a) => a.avatar)
                expect(inputAvatars).to.deep.equalInAnyOrder(outputAvatars)
                expect(inputAvatars).to.deep.equalInAnyOrder(dbAvatars)
            })
            it('updates users date_of_birth and primary user flag', async () => {
                connection.logger.reset()
                for (const u of updateUserInputs) {
                    const month = faker.datatype.number({
                        min: 1,
                        max: 12,
                        precision: 1,
                    })

                    u.dateOfBirth =
                        (month < 10 ? '0' : '') +
                        month +
                        '-' +
                        faker.datatype.number({ min: 1950, max: 2021 })
                    u.primaryUser = faker.datatype.boolean()
                }
                const updateUserResult = await updateUsersResolver(
                    updateUserInputs,
                    userPerformingOperation
                )

                const userConNodes = updateUserResult.users
                expect(userConNodes.length).to.equal(updateUserInputs.length)
                expect(connection.logger.count).to.equal(54)
                const userIds = updateUserInputs.map((uui) => uui.id)
                const currentUsers = await connection.manager
                    .createQueryBuilder(User, 'User')
                    .where('User.user_id IN (:...ids)', { ids: userIds })
                    .getMany()

                updateUserInputs.sort((a, b) =>
                    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
                )
                const inputDobs = updateUserInputs.map((a) => a.dateOfBirth)

                const inputPrimaries = updateUserInputs.map(
                    (a) => a.primaryUser
                )

                userConNodes.sort((a, b) =>
                    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
                )
                const outputDobs = userConNodes.map((a) => a.dateOfBirth)
                currentUsers.sort((a, b) =>
                    a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0
                )
                const dbPrimaries = currentUsers.map((a) => a.primary)
                const dbDobs = currentUsers.map((a) => a.date_of_birth)
                expect(inputDobs).to.deep.equal(outputDobs)
                expect(inputDobs).to.deep.equal(dbDobs)
                expect(inputPrimaries).to.deep.equal(dbPrimaries)
            })
        })

        context('when there are too many input array members', () => {
            beforeEach(async () => {
                const u = await createUser().save()
                updateUserInputs.push(userToUpdateUserInput(u))
            })
            it('it fails to update users', async () => {
                const error = await expect(
                    updateUsersResolver(updateUserInputs, adminUser)
                ).to.be.rejected

                const expectedError: APIError = createInputLengthAPIError(
                    'User',
                    'max'
                )

                compareErrors(error, expectedError)
            })
        })
        context('when there is a validation failure', () => {
            beforeEach(async () => {
                updateUserInputs[2].email = 'somethinghorrid'
            })
            it('it fails to update users', async () => {
                const errorCollection = await expect(
                    updateUsersResolver(updateUserInputs, adminUser)
                ).to.be.rejected

                const expectedErrors: APIError[] = [
                    new APIError({
                        code: customErrors.invalid_email.code,
                        message: customErrors.invalid_email.message,
                        variables: ['email'],
                        entity: 'User',
                        attribute: 'email',
                        index: 2,
                    }),
                ]

                compareMultipleErrors(errorCollection.errors, expectedErrors)
            })
        })
        context('when there is a duplication of id in the input', () => {
            let inputToFail: UpdateUserInput

            beforeEach(async () => {
                inputToFail = updateUserInputs[3]
                inputToFail.id = updateUserInputs[2].id
            })

            it('it fails to update users', async () => {
                const errorCollection = await expect(
                    updateUsersResolver(updateUserInputs, adminUser)
                ).to.be.rejected

                const expectedErrors: APIError[] = [
                    createDuplicateAttributeAPIError(
                        3,
                        ['id'],
                        'UpdateUserInput'
                    ),
                ]

                compareMultipleErrors(errorCollection.errors, expectedErrors)
            })
        })
        context(
            'when there is a duplication of personal info in the input',
            () => {
                let inputToFail: UpdateUserInput

                beforeEach(async () => {
                    inputToFail = updateUserInputs[3]
                    inputToFail.email = updateUserInputs[2].email
                    inputToFail.phone = updateUserInputs[2].phone
                    inputToFail.username = updateUserInputs[2].username
                    inputToFail.givenName = updateUserInputs[2].givenName
                    inputToFail.familyName = updateUserInputs[2].familyName
                })
                it('it fails to update users', async () => {
                    const errorCollection = await expect(
                        updateUsersResolver(updateUserInputs, adminUser)
                    ).to.be.rejected

                    const expectedErrors: APIError[] = [
                        createDuplicateAttributeAPIError(
                            3,
                            [
                                'givenName',
                                'familyName',
                                'username',
                                'phone',
                                'email',
                            ],
                            'UpdateUserInput'
                        ),
                    ]

                    compareMultipleErrors(
                        errorCollection.errors,
                        expectedErrors
                    )
                })
            }
        )
        context(
            'when some matching personal info records already exist on the db with a different user_id',
            () => {
                let u1: User
                let u2: User

                const createExistentError = (user: User, index: number) =>
                    createEntityAPIError(
                        'existent',
                        index,
                        'User',
                        user.user_id,
                        undefined,
                        undefined,
                        ['givenName', 'familyName', 'username', 'email']
                    )

                beforeEach(async () => {
                    u1 = createUser()
                    u2 = createUser()
                    u1.email =
                        clean.email(updateUserInputs[5].email) || undefined
                    u1.phone =
                        clean.phone(updateUserInputs[5].phone) || undefined
                    u1.username = updateUserInputs[5].username || undefined
                    u1.given_name = updateUserInputs[5].givenName
                    u1.family_name = updateUserInputs[5].familyName
                    await u1.save()

                    u2.email =
                        clean.email(updateUserInputs[15].email) || undefined
                    u2.phone =
                        clean.phone(updateUserInputs[15].phone) || undefined
                    u2.username = updateUserInputs[15].username || undefined
                    u2.given_name = updateUserInputs[15].givenName
                    u2.family_name = updateUserInputs[15].familyName
                    await u2.save()
                })

                it('it fails to create users', async () => {
                    const errorCollection = await expect(
                        updateUsersResolver(updateUserInputs, adminUser)
                    ).to.be.rejected

                    const expectedErrors: APIError[] = [
                        createExistentError(u1, 5),
                        createExistentError(u2, 15),
                    ]

                    compareMultipleErrors(
                        errorCollection.errors,
                        expectedErrors
                    )
                })
            }
        )
        context('when one update record does not exist on the db', () => {
            beforeEach(async () => {
                updateUserInputs[23].id = uuid_v4()
            })
            it('it fails to update users', async () => {
                const errorCollection = await expect(
                    updateUsersResolver(updateUserInputs, adminUser)
                ).to.be.rejected

                const expectedErrors: APIError[] = [
                    createEntityAPIError(
                        'nonExistent',
                        23,
                        'User',
                        updateUserInputs[23].id
                    ),
                ]

                compareMultipleErrors(errorCollection.errors, expectedErrors)
            })
        })
        context('when the input array is empty', () => {
            const emptyInputs: UpdateUserInput[] = []
            it('it fails to update users', async () => {
                const error = await expect(
                    updateUsersResolver(emptyInputs, adminUser)
                ).to.be.rejected

                const expectedError: APIError = createInputLengthAPIError(
                    'User',
                    'min'
                )

                compareErrors(error, expectedError)
            })
        })
        context('when any field to update is provided', () => {
            beforeEach(async () => {
                updateUserInputs[23] = { id: updateUserInputs[23].id }
            })

            it('fails to update users', async () => {
                const errorCollection = await expect(
                    updateUsersResolver(updateUserInputs, adminUser)
                ).to.be.rejected

                const expectedErrors: APIError[] = [
                    createInputRequiresAtLeastOne(23, 'UpdateUserInput', [
                        'givenName',
                        'familyName',
                        'email',
                        'phone',
                        'username',
                        'dateOfBirth',
                        'gender',
                        'avatar',
                        'alternateEmail',
                        'alternatePhone',
                        'primaryUser',
                    ]),
                ]

                compareMultipleErrors(errorCollection.errors, expectedErrors)
            })
        })
        context('DB calls', () => {
            const getDbCallCount = async (input: UpdateUserInput[]) => {
                connection.logger.reset()
                await updateUsersResolver(input, adminUser)
                return connection.logger.count
            }

            it('db connections increase in one with number of input elements', async () => {
                const singleProgramExpectedCalls = 5
                await getDbCallCount([updateUserInputs[0]]) // warm up permissions cache

                const singleProgramCount = await getDbCallCount([
                    updateUserInputs[1],
                ])

                const twoProgramsCount = await getDbCallCount([
                    updateUserInputs[2],
                    updateUserInputs[3],
                ])

                expect(singleProgramCount).to.be.eq(singleProgramExpectedCalls)
                expect(twoProgramsCount).to.be.eq(
                    singleProgramExpectedCalls + 1
                )
            })
        })
        context('generateEntityMaps', () => {
            let updateUsers: UpdateUsers
            const generateExistingUsers = async (org: Organization) => {
                const existingUser = await createUser(org).save()
                const nonPermittedOrgUser = await createUser(
                    await createOrgFactory().save()
                ).save()

                const inactiveUser = createUser(org)
                inactiveUser.status = Status.INACTIVE
                await inactiveUser.save()

                const inactiveOrg = createOrgFactory()
                inactiveOrg.status = Status.INACTIVE
                await inactiveOrg.save()
                const inactiveOrgUser = await createUser(inactiveOrg).save()

                return [
                    existingUser,
                    nonPermittedOrgUser,
                    inactiveUser,
                    inactiveOrgUser,
                ]
            }

            beforeEach(async () => {
                const permissions = new UserPermissions(
                    userToPayload(adminUser)
                )

                updateUsers = new UpdateUsers([], permissions)
            })

            it('returns existing users', async () => {
                const existingUsers = await generateExistingUsers(organization1)
                const expectedPairs = existingUsers.map((au) => {
                    return {
                        givenName: au.given_name!,
                        familyName: au.family_name!,
                        username: au.username,
                    }
                })

                const input: UpdateUserInput[] = [
                    ...expectedPairs.map((ep, i) => {
                        return {
                            ...ep,
                            gender: 'female',
                            id: existingUsers[i].user_id,
                        }
                    }),
                    updateUserInputs[0],
                ]

                const entityMaps = await updateUsers.generateEntityMaps(input)

                expect(
                    Array.from(entityMaps.conflictingUsers.keys())
                ).to.deep.equalInAnyOrder(expectedPairs)
            })
        })
    })
    describe('newUser', () => {
        let ourUser: User
        beforeEach(async () => {
            ourUser = createUser()
        })
        context('when everything is provided', () => {
            it('creates a user', async () => {
                const user = await model.newUser(ourUser)
                expect(user).to.not.equal(null)
                const dbUser = await User.findOne({
                    where: { user_id: user?.user_id },
                })
                expect(dbUser).to.not.equal(undefined)
                expect(user?.user_id).to.equal(dbUser?.user_id)
            })
        })

        context('when email phone and username are not provided', () => {
            beforeEach(async () => {
                ourUser.email = undefined
                ourUser.phone = undefined
                ourUser.username = undefined
            })
            it('fails to create a user', async () => {
                const user = await model.newUser(ourUser)
                expect(user).to.equal(null)
            })
        })
    })
})
