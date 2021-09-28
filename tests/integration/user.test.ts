import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import { Model } from '../../src/model'
import { createTestConnection } from '../utils/testConnection'
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
import { createOrganization as organizationFactory } from '../factories/organization.factory'
import { createSchool as schoolFactory } from '../factories/school.factory'
import { createRole as roleFactory } from '../factories/role.factory'
import {
    createUser,
    createAdminUser as adminUserFactory,
} from '../factories/user.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { School } from '../../src/entities/school'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { expectIsNonNullable } from '../utils/assertions'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('user', () => {
    let connection: Connection
    let originalAdmins: string[]
    let testClient: ApolloServerTestClient
    let user: User
    let user2: User

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('set', () => {
        beforeEach(async () => {
            user = await createAdminUser(testClient)
        })

        it('should set the specified user properties', async () => {
            const gqlUpdatedUser = await updateUser(testClient, user, {
                authorization: getAdminAuthToken(),
            })
            const dbUser = await User.findOneOrFail({
                where: { user_id: user.user_id },
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
        beforeEach(async () => {
            user = await createAdminUser(testClient)
            user2 = await createNonAdminUser(testClient)
        })

        context("when primary user doesn't exists", () => {
            it('should set an user as primary', async () => {
                const gqlPrimaryUser = await setPrimaryUser(testClient, user, {
                    authorization: getAdminAuthToken(),
                })
                const dbUser = await User.findOneOrFail({
                    where: { user_id: user.user_id },
                })

                expect(gqlPrimaryUser).to.exist
                expect(dbUser).to.include(gqlPrimaryUser)
                expect(dbUser.primary).to.eq(gqlPrimaryUser.primary)
            })
        })

        context('when primary user already exists', () => {
            it('should unset it and set another as primary', async () => {
                await updateUserEmail(testClient, user2, user.email as string, {
                    authorization: getNonAdminAuthToken(),
                })

                const gqlPrimaryUser = await setPrimaryUser(testClient, user, {
                    authorization: getAdminAuthToken(),
                })
                const gqlNewPrimaryUser = await setPrimaryUser(
                    testClient,
                    user2,
                    { authorization: getNonAdminAuthToken() }
                )

                const dbUser = await User.findOneOrFail({
                    where: { user_id: user.user_id },
                })
                const dbNewPrimaryUser = await User.findOneOrFail({
                    where: { user_id: user2.user_id },
                })

                expect(gqlPrimaryUser).to.exist
                expect(dbUser.primary).to.eql(false)

                expect(gqlNewPrimaryUser).to.exist
                expect(dbNewPrimaryUser).to.include(gqlNewPrimaryUser)
                expect(dbNewPrimaryUser.primary).to.eql(true)
            })
        })

        it('should unset the current primary user and set another as primary', async () => {
            await updateUserEmail(testClient, user2, user.email as string, {
                authorization: getNonAdminAuthToken(),
            })

            const gqlPrimaryUser = await setPrimaryUser(testClient, user, {
                authorization: getAdminAuthToken(),
            })
            const gqlNewPrimaryUser = await setPrimaryUser(testClient, user2, {
                authorization: getNonAdminAuthToken(),
            })

            const dbUser = await User.findOneOrFail({
                where: { user_id: user.user_id },
            })
            const dbNewPrimaryUser = await User.findOneOrFail({
                where: { user_id: user2.user_id },
            })

            expect(gqlPrimaryUser).to.exist
            expect(dbUser.primary).to.eql(false)

            expect(gqlNewPrimaryUser).to.exist
            expect(dbNewPrimaryUser).to.include(gqlNewPrimaryUser)
            expect(dbNewPrimaryUser.primary).to.eql(true)
        })
    })

    describe('memberships', () => {
        beforeEach(async () => {
            user = await createAdminUser(testClient)
        })

        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlMemberships = await getOrganizationMemberships(
                    testClient,
                    user,
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
                    user.user_id
                )
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    organization.organization_id
                )
            })

            it('should return an array containing one organization membership', async () => {
                const gqlMemberships = await getOrganizationMemberships(
                    testClient,
                    user,
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
            user = await createAdminUser(testClient)
            const organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
            )
            organizationId = organization.organization_id
            await addOrganizationToUserAndValidate(
                testClient,
                user.user_id,
                organizationId
            )
        })

        it('should get the organization membership associated with the specified organization ID', async () => {
            const gqlMembership = await getOrganizationMembership(
                testClient,
                user.user_id,
                organizationId,
                { authorization: getAdminAuthToken() }
            )
            const dbMembership = await OrganizationMembership.findOneOrFail({
                where: {
                    user_id: user.user_id,
                    organization_id: organizationId,
                },
            })

            expect(gqlMembership).to.exist
            expect(dbMembership).to.include(gqlMembership)
        })
    })

    describe('school_memberships', () => {
        beforeEach(async () => {
            user = await createAdminUser(testClient)
        })

        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlMemberships = await getSchoolMemberships(
                    testClient,
                    user.user_id,
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
                    user.user_id
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
                    user.user_id,
                    school.school_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return an array containing one school membership', async () => {
                const gqlMemberships = await getSchoolMemberships(
                    testClient,
                    user.user_id,
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
            user = await createAdminUser(testClient)
            const organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
            )
            const school = await createSchool(
                testClient,
                organization.organization_id,
                'my school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            schoolId = school.school_id
            await addUserToSchool(testClient, user.user_id, schoolId, {
                authorization: getAdminAuthToken(),
            })
        })

        it('should get school membership', async () => {
            const gqlMembership = await getSchoolMembership(
                testClient,
                user.user_id,
                schoolId,
                { authorization: getAdminAuthToken() }
            )
            const dbMembership = await SchoolMembership.findOneOrFail({
                where: {
                    user_id: user.user_id,
                    school_id: schoolId,
                },
            })

            expect(gqlMembership).to.exist
            expect(dbMembership).to.include(gqlMembership)
        })
    })

    describe('classesTeaching', () => {
        beforeEach(async () => {
            user = await createAdminUser(testClient)
        })

        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlClasses = await getClassesTeaching(
                    testClient,
                    user.user_id,
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
                    user.user_id
                )
                const cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                await addTeacherToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return an array containing one class', async () => {
                const gqlClasses = await getClassesTeaching(
                    testClient,
                    user.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlClasses).to.exist
                expect(gqlClasses).to.have.lengthOf(1)
            })
        })
    })

    describe('classesStudying', () => {
        beforeEach(async () => {
            user = await createAdminUser(testClient)
        })

        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlClasses = await getClassesStudying(
                    testClient,
                    user.user_id,
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
                    user.user_id
                )
                const cls = await createClass(
                    testClient,
                    organization.organization_id
                )
                await addStudentToClass(
                    testClient,
                    cls.class_id,
                    user.user_id,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should return an array containing one class', async () => {
                const gqlClasses = await getClassesStudying(
                    testClient,
                    user.user_id,
                    { authorization: getAdminAuthToken() }
                )
                expect(gqlClasses).to.exist
                expect(gqlClasses).to.have.lengthOf(1)
            })
        })
    })

    describe('createOrganization', () => {
        const shortcode_re = /^[A-Z|0-9]+$/
        beforeEach(async () => {
            user = await createAdminUser(testClient)
        })

        it('should create an organization', async () => {
            const organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
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
                    user.user_id,
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
                    user.user_id,
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
                        user.user_id,
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
                            user.user_id,
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
                user.user_id
            )
            const organizationOwnership = await OrganizationOwnership.find({
                where: {
                    organization_id: organization.organization_id,
                    user_id: user.user_id,
                },
            })

            expect(organizationOwnership).to.exist
        })

        context('when the user already has an active organisation', () => {
            beforeEach(async () => {
                const organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
            })

            it('does not create another organisation', async () => {
                await expect(
                    createOrganization(testClient, user.user_id, 'Another Org')
                ).to.be.rejected
            })
        })
    })

    describe('addOrganization', () => {
        let organizationId: string

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            const organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
            )
            organizationId = organization.organization_id
        })

        it('user should join the specified organization', async () => {
            const membership = await addOrganizationToUserAndValidate(
                testClient,
                user.user_id,
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
            user = await createAdminUser(testClient)
            tokenOfOrg1Owner = getAdminAuthToken()
            const idOfOrg1Owner = user.user_id
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
        let organization: Organization
        let role: Role
        let school: School
        let oldUser: User
        let newUser: User
        beforeEach(async () => {
            const adminUser = await adminUserFactory().save()
            organization = await organizationFactory(adminUser).save()
            role = await roleFactory(undefined, organization).save()
            school = await schoolFactory(organization).save()

            oldUser = await createUser().save()

            newUser = await createUser().save()
            await createOrganizationMembership({
                user: newUser,
                organization,
                roles: [role],
            }).save()
            await createSchoolMembership({
                user: newUser,
                school,
                roles: [role],
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
                organizations: [organization],
                classesStudying: [],
            })

            await expectMergedUser({
                schools: [school],
                organizations: [organization],
                classesStudying: [],
            })

            await expectDeletedNewUser()
        })
        it('should merge one user into another including classes deleting the source user', async () => {
            const cls = classFactory([], organization)
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
                organizations: [organization],
                classesStudying: [cls],
            })

            await expectMergedUser({
                schools: [school],
                organizations: [organization],
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
        let otherUser: User

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            otherUser = await createNonAdminUser(testClient)
        })

        context('when none', () => {
            it('should return an empty array', async () => {
                const gqlSubjects = await getSubjectsTeaching(
                    testClient,
                    user.user_id,
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
                            user.user_id
                        )
                        role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'add_students_to_class_20225',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'add_teachers_to_class_20226',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'create_subjects_20227',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'edit_subjects_20337',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'edit_class_20334',
                            { authorization: getAdminAuthToken() }
                        )
                        await addOrganizationToUserAndValidate(
                            testClient,
                            otherUser.user_id,
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
                            otherUser.user_id,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            otherUser.user_id,
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
                            otherUser.user_id,
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
                            user.user_id
                        )
                        role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'add_students_to_class_20225',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'add_teachers_to_class_20226',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'create_subjects_20227',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'edit_subjects_20337',
                            { authorization: getAdminAuthToken() }
                        )
                        grantPermission(
                            testClient,
                            role.role_id,
                            'edit_class_20334',
                            { authorization: getAdminAuthToken() }
                        )
                        await addOrganizationToUserAndValidate(
                            testClient,
                            user.user_id,
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
                            user.user_id,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
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
                            user.user_id,
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
                                otherUser.user_id
                            )
                            role = await createRole(
                                testClient,
                                organization.organization_id,
                                getNonAdminAuthToken()
                            )
                            grantPermission(
                                testClient,
                                role.role_id,
                                'add_students_to_class_20225',
                                { authorization: getNonAdminAuthToken() }
                            )
                            grantPermission(
                                testClient,
                                role.role_id,
                                'add_teachers_to_class_20226',
                                { authorization: getNonAdminAuthToken() }
                            )
                            grantPermission(
                                testClient,
                                role.role_id,
                                'create_subjects_20227',
                                { authorization: getNonAdminAuthToken() }
                            )
                            grantPermission(
                                testClient,
                                role.role_id,
                                'edit_subjects_20337',
                                { authorization: getNonAdminAuthToken() }
                            )
                            grantPermission(
                                testClient,
                                role.role_id,
                                'edit_class_20334',
                                { authorization: getNonAdminAuthToken() }
                            )

                            cls = await createClass(
                                testClient,
                                organization.organization_id,
                                getNonAdminAuthToken()
                            )
                            await addTeacherToClass(
                                testClient,
                                cls.class_id,
                                otherUser.user_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                            await addRoleToOrganizationMembership(
                                testClient,
                                otherUser.user_id,
                                organization.organization_id,
                                role.role_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                            await addOrganizationToUserAndValidate(
                                testClient,
                                otherUser.user_id,
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
                                otherUser.user_id,
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
                    addUserToOrganizationAndValidate(
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
})
