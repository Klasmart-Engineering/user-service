import { expect, use } from 'chai'
import { getManager, In } from 'typeorm'
import { Model } from '../../src/model'
import { createTestConnection, TestConnection } from '../utils/testConnection'
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
    createGqlUsers,
    updateGqlUsers,
    userToUpdateUserInput,
    randomChangeToUpdateUserInput,
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
import { createSchool as schoolFactory } from '../factories/school.factory'
import { createRole as roleFactory } from '../factories/role.factory'
import { createUser, createUsers } from '../factories/user.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { School } from '../../src/entities/school'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { expectIsNonNullable } from '../utils/assertions'
import { expectAPIError } from '../utils/apiError'
import {
    addOrganizationRolesToUsers,
    removeOrganizationRolesFromUsers,
    updateUsers,
} from '../../src/resolvers/user'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { errorFormattingWrapper } from '../utils/errors'
import {
    AddOrganizationRolesToUserInput,
    CreateUserInput,
    RemoveOrganizationRolesFromUserInput,
    UpdateUserInput,
    UserConnectionNode,
} from '../../src/types/graphQL/user'
import { mapUserToUserConnectionNode } from '../../src/pagination/usersConnection'
import clean from '../../src/utils/clean'
import faker from 'faker'
import { v4 as uuid_v4 } from 'uuid'
import { config } from '../../src/config/config'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('user', () => {
    let connection: TestConnection
    let originalAdmins: string[]
    let testClient: ApolloServerTestClient
    let adminUser: User
    let nonAdminUser: User
    let organization1: Organization
    let role1: Role

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
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

    describe('createUsers', () => {
        let idOfUserPerformingOperation: string
        let organizationId: string
        let arbitraryUserToken: string
        let createUserInputs: CreateUserInput[]
        let adminToken: string
        beforeEach(async () => {
            idOfUserPerformingOperation = (await createNonAdminUser(testClient))
                .user_id
            arbitraryUserToken = getNonAdminAuthToken()
            const orgOwner = await createAdminUser(testClient)
            adminToken = getAdminAuthToken()
            organizationId = (
                await createOrganizationAndValidate(
                    testClient,
                    orgOwner.user_id
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
                    createGqlUsers(testClient, createUserInputs, {
                        authorization: arbitraryUserToken,
                    })
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
                const gqlcreateUserResult = await createGqlUsers(
                    testClient,
                    createUserInputs,
                    { authorization: adminToken }
                )
                const userConNodes = gqlcreateUserResult.users
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
                const gqlcreateUserResult = await createGqlUsers(
                    testClient,
                    createUserInputs,
                    { authorization: arbitraryUserToken }
                )
                const userConNodes = gqlcreateUserResult.users
                expect(connection.logger.count).to.equal(6)
                expect(userConNodes.length).to.equal(createUserInputs.length)
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers - previousUsers).to.equal(
                    createUserInputs.length
                )
            })
        })
        context('when there are too many input array members', () => {
            beforeEach(async () => {
                createUserInputs.push(userToCreateUserInput(createUser()))
            })
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                await expect(
                    createGqlUsers(testClient, createUserInputs, {
                        authorization: adminToken,
                    })
                ).to.be.rejected
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('when there is a validation failure', () => {
            beforeEach(async () => {
                createUserInputs[2].contactInfo.email = 'somethinghorrid'
            })
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                await expect(
                    createGqlUsers(testClient, createUserInputs, {
                        authorization: adminToken,
                    })
                ).to.be.rejected
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
                await expect(
                    createGqlUsers(testClient, createUserInputs, {
                        authorization: adminToken,
                    })
                ).to.be.rejected
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
            })
        })
        context('when some matching records already exist on the db', () => {
            beforeEach(async () => {
                const oldInputs: CreateUserInput[] = []
                oldInputs.push(createUserInputs[5])
                oldInputs.push(createUserInputs[35])
                await createGqlUsers(testClient, oldInputs, {
                    authorization: adminToken,
                })
            })
            it('it fails to create users', async () => {
                const previousUsers = await connection
                    .getRepository(User)
                    .count()
                await expect(
                    createGqlUsers(testClient, createUserInputs, {
                        authorization: adminToken,
                    })
                ).to.be.rejected
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
                await expect(
                    createGqlUsers(testClient, emptyInputs, {
                        authorization: adminToken,
                    })
                ).to.be.rejected
                const currentUsers = await connection
                    .getRepository(User)
                    .count()
                expect(currentUsers).to.equal(previousUsers)
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
            for (const [idx, val] of input.entries()) {
                const { organizationId, userId, roleIds } = val
                const dbMembership = await OrganizationMembership.findOneOrFail(
                    {
                        where: {
                            organization_id: organizationId,
                            user_id: userId,
                        },
                        relations: ['roles'],
                    }
                )

                const dbRoleIds = (await dbMembership.roles)
                    ?.map((r) => r.role_id)
                    .sort()
                const expectedRoleIds = modifyRolesFn(
                    initialRoles[idx],
                    roleIds
                )
                expect(expectedRoleIds).to.deep.equal(dbRoleIds)
            }
        }

        beforeEach(async () => {
            ;[
                organization1,
                organization2,
                organization3,
            ] = await Organization.save(createOrganizations(3))
            ;[user1, user2, user3] = await User.save(createUsers(3))
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

        // All the tests for .modifyOrganizationRoles are done here, as well as a specific one for .addOrganizationRolesToUsers
        context('when called by .addOrganizationRolesToUsers', () => {
            function addOrgRoles(authUser = adminUser) {
                return errorFormattingWrapper(
                    addOrganizationRolesToUsers(
                        { input: input },
                        {
                            permissions: new UserPermissions({
                                id: authUser.user_id,
                                email: authUser.email,
                                phone: authUser.phone,
                            }),
                        }
                    )
                )
            }

            function checkNotFoundErrors(
                actualError: Error,
                expectedErrors: {
                    entity: string
                    id: string
                    entryIndex: number
                }[],
                totalErrorCount?: number
            ) {
                expectedErrors.forEach((val, errorIndex) => {
                    const getVar = () => {
                        switch (val.entity) {
                            case 'Role':
                                return 'role_id'
                            case 'Organization':
                                return 'organization_id'
                            case 'User':
                                return 'user_id'
                            default:
                                return ''
                        }
                    }
                    expectAPIError.nonexistent_or_inactive(
                        actualError,
                        {
                            entity: val.entity,
                            attribute: val.entity === 'Role' ? 'IDs' : 'ID',
                            otherAttribute: val.id,
                            index: val.entryIndex,
                        },
                        [getVar()],
                        errorIndex,
                        totalErrorCount ?? expectedErrors.length
                    )
                })
            }

            async function checkNoChangesMade(useAdminUser = true) {
                it('does not add the users', async () => {
                    await expect(
                        addOrgRoles(useAdminUser ? undefined : nonAdminUser)
                    ).to.be.rejected
                    const memberships = await OrganizationMembership.find({
                        where: {
                            organization_id: In(
                                [
                                    organization1,
                                    organization2,
                                    organization3,
                                ].map((o) => o.organization_id)
                            ),
                            user_id: In(
                                [user1, user2, user3].map((u) => u.user_id)
                            ),
                        },
                    })
                    memberships.forEach((m) => expect(m.roles).to.be.empty)
                })
            }

            function checkRolesAdded() {
                return checkDbHasExpectedValues(
                    (currentRoles: Role[], roleIdsToAdd: string[]) => {
                        roleIdsToAdd.push(...currentRoles.map((r) => r.role_id))
                        return [...new Set(roleIdsToAdd.sort())]
                    }
                )
            }

            beforeEach(async () => {
                initialRoles = [[role3], [], []]
                await OrganizationMembership.save([
                    createOrganizationMembership({
                        user: user1,
                        organization: organization1,
                        roles: initialRoles[0],
                    }),
                    createOrganizationMembership({
                        user: user2,
                        organization: organization2,
                    }),
                    createOrganizationMembership({
                        user: user3,
                        organization: organization3,
                    }),
                ])
            })

            context('and caller has permissions to add roles to user', () => {
                context('and all attributes are valid', () => {
                    it('adds all the roles', async () => {
                        await expect(addOrgRoles()).to.be.fulfilled
                        await checkRolesAdded()
                    })

                    it('makes the expected number of queries to the database', async () => {
                        connection.logger.reset()
                        await addOrgRoles()
                        expect(connection.logger.count).to.be.eq(10)
                        // 1 from permission check
                        // 4 from preloaded queries
                        // 5 from saving OrganizationMembership[] (1 per)
                    })
                })

                context('and one of the roles was already added', () => {
                    beforeEach(async () => {
                        await createOrganizationMembership({
                            user: user1,
                            organization: organization1,
                            roles: [role1, role3],
                        }).save()
                    })

                    it('adds all the roles', async () => {
                        await expect(addOrgRoles()).to.be.fulfilled
                        await checkRolesAdded()
                    })
                })

                context(
                    'and one of the organizations is inactive',
                    async () => {
                        beforeEach(
                            async () =>
                                await organization3.inactivate(getManager())
                        )

                        it('returns an inactive or nonexistent organization error', async () => {
                            const res = await expect(addOrgRoles()).to.be
                                .rejected
                            checkNotFoundErrors(res, [
                                {
                                    entity: 'Organization',
                                    id: organization3.organization_id,
                                    entryIndex: 2,
                                },
                            ])
                        })

                        await checkNoChangesMade()
                    }
                )

                context('and one of the users is inactive', async () => {
                    beforeEach(async () => await user2.inactivate(getManager()))

                    it('returns an inactive or nonexistent user error', async () => {
                        const res = await expect(addOrgRoles()).to.be.rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'User',
                                id: user2.user_id,
                                entryIndex: 1,
                            },
                        ])
                    })

                    await checkNoChangesMade()
                })

                context('and one of the roles is inactive', async () => {
                    beforeEach(async () => await role1.inactivate(getManager()))

                    it('returns an inactive or nonexistent role error', async () => {
                        const res = await expect(addOrgRoles()).to.be.rejected
                        checkNotFoundErrors(res, [
                            {
                                entity: 'Role',
                                id: role1.role_id,
                                entryIndex: 0,
                            },
                        ])
                    })

                    await checkNoChangesMade()
                })

                context('and one of the memberships is inactive', async () => {
                    beforeEach(async () => {
                        const membs = (await user1.memberships) || []
                        for (const m of membs) await m.inactivate(getManager())
                    })

                    it('returns a nonexistent child error', async () => {
                        const res = await expect(addOrgRoles()).to.be.rejected
                        expectAPIError.nonexistent_child(
                            res,
                            {
                                entity: 'User',
                                entityName: user1.user_name(),
                                parentEntity:
                                    'OrganizationMembership in Organization',
                                parentName:
                                    organization1.organization_name || '',
                                index: 0,
                            },
                            ['organization_id', 'user_id'],
                            0,
                            1
                        )
                    })

                    await checkNoChangesMade()
                })

                context('and multiple attributes are inactive', async () => {
                    beforeEach(async () => {
                        const membs = (await user3.memberships) || []
                        for (const m of membs) await m.inactivate(getManager())
                        await Promise.all([
                            user1.inactivate(getManager()),
                            role1.inactivate(getManager()),
                            role2.inactivate(getManager()),
                        ])
                    })

                    it('returns several inactive or nonexistent errors', async () => {
                        const res = await expect(addOrgRoles()).to.be.rejected
                        checkNotFoundErrors(
                            res,
                            [
                                {
                                    entity: 'Role',
                                    id: [
                                        role1.role_id,
                                        role2.role_id,
                                    ].toString(),
                                    entryIndex: 0,
                                },
                                {
                                    entity: 'User',
                                    id: user1.user_id,
                                    entryIndex: 0,
                                },
                                {
                                    entity: 'Role',
                                    id: role2.role_id,
                                    entryIndex: 1,
                                },
                            ],
                            4
                        )
                        expectAPIError.nonexistent_child(
                            res,
                            {
                                entity: 'User',
                                entityName: user3.user_name(),
                                parentEntity:
                                    'OrganizationMembership in Organization',
                                parentName:
                                    organization3.organization_name || '',
                                index: 2,
                            },
                            ['organization_id', 'user_id'],
                            3,
                            4
                        )
                    })

                    await checkNoChangesMade()
                })
            })

            context(
                'and caller does not have permissions to add roles to all users',
                async () => {
                    beforeEach(async () => {
                        const nonAdminRole = await roleFactory(
                            'Non Admin Role',
                            organization1,
                            {
                                permissions: [PermissionName.edit_users_40330],
                            }
                        ).save()
                        await createOrganizationMembership({
                            user: nonAdminUser,
                            organization: organization1,
                            roles: [nonAdminRole],
                        }).save()
                    })

                    it('returns a permission error', async () => {
                        const rejectedOrgIds = [
                            organization2.organization_id,
                            organization3.organization_id,
                        ].toString()
                        await expect(
                            addOrgRoles(nonAdminUser)
                        ).to.be.rejectedWith(
                            `User(${nonAdminUser.user_id}) does not have Permission(${PermissionName.edit_users_40330}) in Organizations(${rejectedOrgIds})`
                        )
                    })

                    it('makes the expected number of queries to the database', async () => {
                        connection.logger.reset()
                        await expect(addOrgRoles(nonAdminUser)).to.be.rejected
                        expect(connection.logger.count).to.be.eq(2) // 1 for user check, 1 for org permission check
                    })

                    await checkNoChangesMade(false)
                }
            )
        })

        // There is only one test specifically for .removeOrganizationRolesFromUsers, all common tests are done with .addOrganizationRolesToUsers
        context('when called by .removeOrganizationRolesFromUsers', () => {
            function removeOrgRoles(authUser = adminUser) {
                return errorFormattingWrapper(
                    removeOrganizationRolesFromUsers(
                        { input: input },
                        {
                            permissions: new UserPermissions({
                                id: authUser.user_id,
                                email: authUser.email,
                                phone: authUser.phone,
                            }),
                        }
                    )
                )
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
    describe('UpdateUsers', () => {
        let idOfUserPerformingOperation: string
        let userPerformingOperation: User
        let organizationId: string
        let arbitraryUserToken: string
        let updateUserInputs: UpdateUserInput[]
        let adminToken: string
        beforeEach(async () => {
            faker.seed(123456)

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
            for (
                let i = 0;
                i < config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE;
                i++
            ) {
                const u = await createUser().save()
                updateUserInputs.push(
                    randomChangeToUpdateUserInput(userToUpdateUserInput(u))
                )
            }
        })

        context('when not authorized', () => {
            it('it fails to update users', async () => {
                await expect(
                    updateUsers(
                        { input: updateUserInputs },
                        {
                            permissions: new UserPermissions({
                                id: userPerformingOperation.user_id,
                                email: userPerformingOperation.email,
                                phone: userPerformingOperation.phone,
                            }),
                        }
                    )
                ).to.be.rejected
            })
        })
        context('when admin', () => {
            it('updates users', async () => {
                const updateUserResult = await updateUsers(
                    { input: updateUserInputs },
                    {
                        permissions: new UserPermissions({
                            id: adminUser.user_id,
                            email: adminUser.email,
                            phone: adminUser.phone,
                        }),
                    }
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
                const updateUserResult = await updateUsers(
                    { input: updateUserInputs },
                    {
                        permissions: new UserPermissions({
                            id: userPerformingOperation.user_id,
                            email: userPerformingOperation.email,
                            phone: userPerformingOperation.phone,
                        }),
                    }
                )
                const userConNodes = updateUserResult.users
                expect(userConNodes.length).to.equal(updateUserInputs.length)
                expect(connection.logger.count).to.equal(56)
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
        context('when there are too many input array members', () => {
            beforeEach(async () => {
                const u = await createUser().save()
                updateUserInputs.push(userToUpdateUserInput(u))
            })
            it('it fails to update users', async () => {
                await expect(
                    updateUsers(
                        { input: updateUserInputs },
                        {
                            permissions: new UserPermissions({
                                id: adminUser.user_id,
                                email: adminUser.email,
                                phone: adminUser.phone,
                            }),
                        }
                    )
                ).to.be.rejected
            })
        })
        context('when there is a validation failure', () => {
            beforeEach(async () => {
                updateUserInputs[2].email = 'somethinghorrid'
            })
            it('it fails to update users', async () => {
                await expect(
                    updateUsers(
                        { input: updateUserInputs },
                        {
                            permissions: new UserPermissions({
                                id: adminUser.user_id,
                                email: adminUser.email,
                                phone: adminUser.phone,
                            }),
                        }
                    )
                ).to.be.rejected
            })
        })
        context('when there is a duplication of id in the input', () => {
            beforeEach(async () => {
                updateUserInputs[3].id = updateUserInputs[2].id
            })
            it('it fails to update users', async () => {
                await expect(
                    updateUsers(
                        { input: updateUserInputs },
                        {
                            permissions: new UserPermissions({
                                id: adminUser.user_id,
                                email: adminUser.email,
                                phone: adminUser.phone,
                            }),
                        }
                    )
                ).to.be.rejected
            })
        })
        context(
            'when there is a duplication of personal info in the input',
            () => {
                beforeEach(async () => {
                    updateUserInputs[3].email = updateUserInputs[2].email
                    updateUserInputs[3].phone = updateUserInputs[2].phone
                    updateUserInputs[3].givenName =
                        updateUserInputs[2].givenName
                    updateUserInputs[3].familyName =
                        updateUserInputs[2].familyName
                })
                it('it fails to update users', async () => {
                    await expect(
                        updateUsers(
                            { input: updateUserInputs },
                            {
                                permissions: new UserPermissions({
                                    id: adminUser.user_id,
                                    email: adminUser.email,
                                    phone: adminUser.phone,
                                }),
                            }
                        )
                    ).to.be.rejected
                })
            }
        )
        context(
            'when some matching personal info records already exist on the db with a different user_id',
            () => {
                beforeEach(async () => {
                    const u1 = createUser()
                    const u2 = createUser()
                    u1.email =
                        clean.email(updateUserInputs[5].email) || undefined
                    u1.phone =
                        clean.phone(updateUserInputs[5].phone) || undefined
                    u1.given_name = updateUserInputs[5].givenName
                    u1.family_name = updateUserInputs[5].familyName
                    await u1.save()

                    u2.email =
                        clean.email(updateUserInputs[15].email) || undefined
                    u2.phone =
                        clean.phone(updateUserInputs[15].phone) || undefined
                    u2.given_name = updateUserInputs[15].givenName
                    u2.family_name = updateUserInputs[15].familyName
                    await u2.save()
                })
                it('it fails to create users', async () => {
                    await expect(
                        updateUsers(
                            { input: updateUserInputs },
                            {
                                permissions: new UserPermissions({
                                    id: adminUser.user_id,
                                    email: adminUser.email,
                                    phone: adminUser.phone,
                                }),
                            }
                        )
                    ).to.be.rejected
                })
            }
        )
        context('when one update record does not exist on the db', () => {
            beforeEach(async () => {
                updateUserInputs[23].id = uuid_v4()
            })
            it('it fails to update users', async () => {
                await expect(
                    updateUsers(
                        { input: updateUserInputs },
                        {
                            permissions: new UserPermissions({
                                id: adminUser.user_id,
                                email: adminUser.email,
                                phone: adminUser.phone,
                            }),
                        }
                    )
                ).to.be.rejected
            })
        })
        context('when the input array is empty', () => {
            const emptyInputs: UpdateUserInput[] = []
            it('it fails to update users', async () => {
                await expect(
                    updateUsers(
                        { input: emptyInputs },
                        {
                            permissions: new UserPermissions({
                                id: adminUser.user_id,
                                email: adminUser.email,
                                phone: adminUser.phone,
                            }),
                        }
                    )
                ).to.be.rejected
            })
        })
    })
})
