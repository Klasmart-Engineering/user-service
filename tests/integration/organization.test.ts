import { expect, use } from 'chai'
import faker from 'faker'
import { createQueryBuilder, getManager, getRepository, In } from 'typeorm'
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError'
import { Model } from '../../src/model'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { AgeRange } from '../../src/entities/ageRange'
import { Grade } from '../../src/entities/grade'
import { User } from '../../src/entities/user'
import { School } from '../../src/entities/school'
import { Category } from '../../src/entities/category'
import { Subcategory } from '../../src/entities/subcategory'
import { Subject } from '../../src/entities/subject'
import { Status } from '../../src/entities/status'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../utils/operations/userOps'
import {
    createAdminUser,
    createNonAdminUser,
    validUser,
} from '../utils/testEntities'
import { addRoleToOrganizationMembership } from '../utils/operations/organizationMembershipOps'
import {
    addUserToOrganizationAndValidate,
    createOrUpdateAgeRanges,
    createOrUpdateGrades,
    createOrUpdateSubcategories,
    createOrUpdateCategories,
    createOrUpdateSubjects,
    createSchool,
    createClass,
    createRole,
    inviteUser,
    editMembership,
    listAgeRanges,
    listGrades,
    listCategories,
    listSubcategories,
    listSubjects,
    deleteOrganization,
    listPrograms,
    createOrUpdatePrograms,
    updateOrganization,
    listClasses,
    getSystemRoleIds,
} from '../utils/operations/organizationOps'
import { grantPermission } from '../utils/operations/roleOps'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { addUserToSchool } from '../utils/operations/schoolOps'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import {
    getAdminAuthToken,
    getNonAdminAuthToken,
    generateToken,
} from '../utils/testConfig'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { OrganizationOwnership } from '../../src/entities/organizationOwnership'
import { PermissionName } from '../../src/permissions/permissionNames'
import { Role } from '../../src/entities/role'
import { createAgeRange } from '../factories/ageRange.factory'
import { createGrade } from '../factories/grade.factory'
import { createCategory } from '../factories/category.factory'
import { createSubcategory } from '../factories/subcategory.factory'
import {
    createOrganization,
    createOrganizations,
} from '../factories/organization.factory'
import {
    createRole as roleFactory,
    createRoles,
} from '../factories/role.factory'
import { createSchool as schoolFactory } from '../factories/school.factory'
import { createSubject } from '../factories/subject.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import {
    createUser as userFactory,
    createAdminUser as adminUserFactory,
    createUser,
    createUsers,
} from '../factories/user.factory'
import chaiAsPromised from 'chai-as-promised'
import { Program } from '../../src/entities/program'
import { createProgram } from '../factories/program.factory'
import { SHORTCODE_DEFAULT_MAXLEN } from '../../src/utils/shortcode'
import { Class } from '../../src/entities/class'
import { addSchoolToClass } from '../utils/operations/classOps'
import _, { pick } from 'lodash'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import {
    EditMembershipArguments,
    InviteUserArguments,
} from '../../src/operations/organization'
import { Headers } from 'node-mocks-http'
import { expectAPIError, expectToBeAPIErrorCollection } from '../utils/apiError'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import {
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
    RemoveUsersFromOrganizationInput,
} from '../../src/types/graphQL/organization'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    AddUsersToOrganizations,
    RemoveUsersFromOrganizations,
} from '../../src/resolvers/organization'
import { mutate } from '../../src/utils/mutations/commonStructure'
import { buildPermissionError } from '../utils/errors'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('organization', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let organization: Organization
    let role: Role
    let adminUser: User
    let nonAdminUser: User
    let orgs: Organization[]
    let users: User[]
    let roles: Role[]
    const shortcode_re = /^[A-Z|0-9]+$/

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('set', async () => {
        let organizationId: string
        const mods = {
            organization_name: 'New Name',
            address1: 'New address 1',
            address2: 'New address 2',
            phone: '010-1111-2222',
            shortCode: 'SC',
        }
        let arbitraryUserToken: string

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()
            organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            organizationId = organization.organization_id
        })

        context('when organization is inactive', () => {
            beforeEach(async () => {
                await deleteOrganization(testClient, organizationId, {
                    authorization: getAdminAuthToken(),
                })
            })

            it('returns null and database entry is not modified', async () => {
                const gqlOrg = await updateOrganization(
                    testClient,
                    organizationId,
                    mods,
                    { authorization: arbitraryUserToken }
                )

                expect(gqlOrg).to.be.null
                const dbOrg = await Organization.findOneOrFail(organizationId)
                expect(dbOrg).to.not.include(mods)
            })
        })

        context('when authorized within organization', () => {
            let idOfUserMakingMod: string
            let authTokenOfUserMakingMod: string

            beforeEach(async () => {
                idOfUserMakingMod = (await createNonAdminUser(testClient))
                    .user_id
                authTokenOfUserMakingMod = getNonAdminAuthToken()
                await addUserToOrganizationAndValidate(
                    testClient,
                    idOfUserMakingMod,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
                const editOrgRole = await createRole(testClient, organizationId)
                await grantPermission(
                    testClient,
                    editOrgRole.role_id,
                    PermissionName.edit_an_organization_details_5,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    idOfUserMakingMod,
                    organization.organization_id,
                    editOrgRole.role_id
                )
            })

            it('returns the modified organization, and database entry is modified', async () => {
                const gqlOrg = await updateOrganization(
                    testClient,
                    organizationId,
                    mods,
                    { authorization: authTokenOfUserMakingMod }
                )

                expect(gqlOrg).to.include(mods)
                const dbOrg = await Organization.findOneOrFail(organizationId)
                expect(dbOrg).to.include(mods)
            })
        })

        context('when not authorized within organization', () => {
            let idOfUserMakingMod: string
            const authTokenOfUserMakingMod = getNonAdminAuthToken()

            beforeEach(async () => {
                idOfUserMakingMod = (await createNonAdminUser(testClient))
                    .user_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    idOfUserMakingMod,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should throw a permission exception and not mutate the database entry', async () => {
                await expect(
                    updateOrganization(testClient, organizationId, mods, {
                        authorization: authTokenOfUserMakingMod,
                    })
                ).to.be.rejected

                const dbOrg = await Organization.findOneOrFail(organizationId)
                expect(dbOrg).to.not.include(mods)
            })
        })
    })

    describe('updateOrCreateUser', async () => {
        const allProperties = [
            'given_name',
            'family_name',
            'gender',
            'email',
            'phone',
            'date_of_birth',
            'username',
            'alternate_email',
            'alternate_phone',
        ]

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
        })

        it('should assign the old user to the exsting user', async () => {
            const email = adminUser.email ?? ''
            const oldUser: User = await organization['updateOrCreateUser']({
                user_id: adminUser.user_id,
                email,
                given_name: adminUser.given_name!,
                family_name: adminUser.family_name!,
                gender: adminUser.gender!,
            })
            expect(oldUser).to.exist
            expect(oldUser.user_id).to.equal(adminUser.user_id)
        })
        it('should assign the new user to a new user with an email', async () => {
            const newUser: User = await organization['updateOrCreateUser']({
                email: 'bob@nowhere.com',
                given_name: 'Bob',
                family_name: 'Smith',
                gender: 'Male',
            })
            expect(newUser).to.exist
            expect(newUser.email).to.equal('bob@nowhere.com')
        })

        it('should assign the new user to a new user with a phone number', async () => {
            const newUser: User = await organization['updateOrCreateUser']({
                phone: '+44207344141',
                given_name: 'Bob',
                family_name: 'Smith',
                gender: 'Male',
            })
            expect(newUser).to.exist
            expect(newUser.phone).to.equal('+44207344141')
        })

        context('existing user', () => {
            let oldUser: User

            beforeEach(async () => {
                oldUser = await createUser({
                    alternate_email: faker.internet.email(),
                    alternate_phone: faker.phone.phoneNumber(),
                }).save()
            })
            it('should not clobber User properties if undefined on input', async () => {
                const updatedInfo = {
                    given_name: faker.name.firstName(),
                    family_name: faker.name.lastName(),
                    gender: 'Female',
                }

                const newUser = await organization['updateOrCreateUser']({
                    user_id: oldUser.user_id,
                    ...updatedInfo,
                })
                expect(newUser.user_id).to.equal(oldUser.user_id)

                const changedProperties = Object.keys(updatedInfo)
                expect(pick(newUser, changedProperties)).to.deep.equal(
                    updatedInfo
                )

                const unchangedProperties = allProperties.filter(
                    (k) => !changedProperties.includes(k)
                )
                expect(pick(newUser, unchangedProperties)).to.deep.equal(
                    pick(oldUser, unchangedProperties)
                )
            })

            it('should update all defined User properties', async () => {
                const updatedInfo = {
                    given_name: faker.name.firstName(),
                    family_name: faker.name.lastName(),
                    gender: 'Female',
                    email: faker.internet.email(),
                    phone: faker.phone.phoneNumber(),
                    date_of_birth: '06-1994',
                    username: faker.internet.userName(),
                    alternate_email: faker.internet.email(),
                    alternate_phone: faker.phone.phoneNumber(),
                }

                const newUser = await organization['updateOrCreateUser']({
                    user_id: oldUser.user_id,
                    ...updatedInfo,
                })
                expect(newUser.user_id).to.equal(oldUser.user_id)

                expect(pick(newUser, allProperties)).to.deep.equal(updatedInfo)
            })
        })
    })

    describe('membershipOrganization', async () => {
        context('we have a user and an organization', () => {
            let adminUserId: string
            let organizationId: string
            beforeEach(async () => {
                adminUser = await createAdminUser(testClient)
                adminUserId = adminUser.user_id
                organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
                organizationId = organization.organization_id
                role = await createRole(
                    testClient,
                    organization.organization_id,
                    'student'
                )
            })
            it('Should set the user as a member of the organization', async () => {
                const membership = await organization['membershipOrganization'](
                    adminUser,
                    new Array(role)
                )
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(adminUserId)
            })
        })
    })

    describe('createClass', async () => {
        let adminUserId: string
        let organizationId: string
        const classInfo = (cls: any) => {
            return cls.class_id
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            adminUserId = adminUser.user_id
            organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            organizationId = organization.organization_id
        })

        context('when class name is empty', () => {
            it('does not create the class', async () => {
                const cls = await createClass(
                    testClient,
                    organizationId,
                    '',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                expect(cls).to.be.null
                const dbOrg = await Organization.findOneOrFail(organizationId)
                const orgClasses = (await dbOrg.classes) || []
                expect(orgClasses).to.be.empty
            })
        })

        context('when class shortcode is undefined', () => {
            it('it creates the class', async () => {
                const cls = await createClass(
                    testClient,
                    organizationId,
                    'Some Class 1',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )

                expect(cls).not.to.be.null
                expect(cls.shortcode).not.to.be.undefined
                const dbOrg = await Organization.findOneOrFail(organizationId)
                const orgClasses = (await dbOrg.classes) || []
                expect(orgClasses.map(classInfo)).to.deep.eq([cls.class_id])
                expect(cls.status).to.eq(Status.ACTIVE)
            })
        })

        context('when class shortcode is empty', () => {
            it('it creates the class', async () => {
                const cls = await createClass(
                    testClient,
                    organizationId,
                    'Some Class 1',
                    '',
                    { authorization: getAdminAuthToken() }
                )

                expect(cls).not.to.be.null
                expect(cls.shortcode).not.to.be.empty
                const dbOrg = await Organization.findOneOrFail(organizationId)
                const orgClasses = (await dbOrg.classes) || []
                expect(orgClasses.map(classInfo)).to.deep.eq([cls.class_id])
                expect(cls.status).to.eq(Status.ACTIVE)
            })
        })

        context('when class shortcode is not empty', () => {
            context('and the shortcode is valid', () => {
                it('it creates the class', async () => {
                    const cls = await createClass(
                        testClient,
                        organizationId,
                        'Some Class 1',
                        'BLOB2',
                        { authorization: getAdminAuthToken() }
                    )

                    expect(cls).not.to.be.null
                    expect(cls.shortcode).to.match(shortcode_re)
                    expect(cls.shortcode).to.equal('BLOB2')
                    const dbOrg = await Organization.findOneOrFail(
                        organizationId
                    )
                    const orgClasses = (await dbOrg.classes) || []
                    expect(orgClasses.map(classInfo)).to.deep.eq([cls.class_id])
                    expect(cls.status).to.eq(Status.ACTIVE)
                })
            })

            context('and the shortcode is not valid', () => {
                it('fails to create a class', async () => {
                    await expect(
                        createClass(
                            testClient,
                            organizationId,
                            'Some Class 1',
                            'very horrid',
                            { authorization: getAdminAuthToken() }
                        )
                    ).to.be.rejected
                })
            })
        })

        context('when class name is not empty', () => {
            it('creates the class', async () => {
                const cls = await createClass(
                    testClient,
                    organizationId,
                    'Some Class 1',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )

                expect(cls).not.to.be.null
                expect(cls.shortcode).to.match(shortcode_re)
                expect(cls.shortcode?.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
                const dbOrg = await Organization.findOneOrFail(organizationId)
                const orgClasses = (await dbOrg.classes) || []
                expect(orgClasses.map(classInfo)).to.deep.eq([cls.class_id])
                expect(cls.status).to.eq(Status.ACTIVE)
            })

            context(
                'and the class name is duplicated in the same organization',
                () => {
                    let oldClass: any

                    beforeEach(async () => {
                        oldClass = await createClass(
                            testClient,
                            organizationId,
                            'Some Class 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('does not create the class', async () => {
                        const cls = await createClass(
                            testClient,
                            organizationId,
                            'Some Class 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )

                        expect(cls).to.be.null
                        const dbOrg = await Organization.findOneOrFail(
                            organizationId
                        )
                        const orgClasses = (await dbOrg.classes) || []
                        expect(orgClasses.map(classInfo)).to.deep.eq([
                            oldClass.class_id,
                        ])
                    })
                }
            )

            context(
                'and the class name is duplicated in different organizations',
                () => {
                    let otherClass: any

                    beforeEach(async () => {
                        const otherUser = await createNonAdminUser(testClient)
                        const otherUserId = otherUser.user_id
                        const otherOrganization = await createOrganizationAndValidate(
                            testClient,
                            otherUserId,
                            'Other Organization'
                        )
                        const otherOrganizationId =
                            otherOrganization.organization_id
                        otherClass = await createClass(
                            testClient,
                            otherOrganizationId,
                            'Some Class 1',
                            undefined,
                            { authorization: getNonAdminAuthToken() }
                        )
                    })

                    it('creates the class', async () => {
                        const cls = await createClass(
                            testClient,
                            organizationId,
                            'Some Class 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )

                        expect(cls).not.to.be.null
                        const dbOrg = await Organization.findOneOrFail(
                            organizationId
                        )
                        const orgClasses = (await dbOrg.classes) || []
                        expect(orgClasses.map(classInfo)).to.deep.eq([
                            cls.class_id,
                        ])
                        expect(cls.class_id).to.not.eq(otherClass.class_id)
                        expect(cls.class_name).to.eq(otherClass.class_name)
                        expect(cls.status).to.eq(Status.ACTIVE)
                    })

                    context(
                        'and the organization is marked as inactive',
                        () => {
                            beforeEach(async () => {
                                await deleteOrganization(
                                    testClient,
                                    organization.organization_id,
                                    { authorization: getAdminAuthToken() }
                                )
                            })

                            it('fails to create class in the organization', async () => {
                                const cls = await createClass(
                                    testClient,
                                    organizationId,
                                    '',
                                    undefined,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(cls).to.be.null
                                const dbOrg = await Organization.findOneOrFail(
                                    organizationId
                                )
                                const orgClasses = (await dbOrg.classes) || []
                                expect(orgClasses).to.be.empty
                            })
                        }
                    )
                }
            )
        })
    })

    describe('createSchool', async () => {
        let organizationId: string
        const schoolInfo = (school: any) => {
            return school.school_id
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            organizationId = organization.organization_id
        })

        context('when school name is empty', () => {
            it('does not create the school', async () => {
                const school = await createSchool(
                    testClient,
                    organizationId,
                    '',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )

                expect(school).to.be.null
                const dbSchool = await Organization.findOneOrFail(
                    organizationId
                )
                const orgSchools = (await dbSchool.schools) || []
                expect(orgSchools).to.be.empty
            })
        })

        context('when school shortcode is undefined', () => {
            it('creates the school', async () => {
                const school = await createSchool(
                    testClient,
                    organizationId,
                    'some school 1',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )

                expect(school).not.to.be.null
                expect(school.shortcode).not.to.be.undefined
                const dbSchool = await Organization.findOneOrFail(
                    organizationId
                )
                const orgSchools = (await dbSchool.schools) || []
                expect(orgSchools.map(schoolInfo)).to.deep.eq([
                    school.school_id,
                ])
            })
        })

        context('when school shortcode is empty', () => {
            it('creates the school', async () => {
                const school = await createSchool(
                    testClient,
                    organizationId,
                    'some school 1',
                    '',
                    { authorization: getAdminAuthToken() }
                )

                expect(school).not.to.be.null
                expect(school.shortcode).not.to.be.empty
                const dbSchool = await Organization.findOneOrFail(
                    organizationId
                )
                const orgSchools = (await dbSchool.schools) || []
                expect(orgSchools.map(schoolInfo)).to.deep.eq([
                    school.school_id,
                ])
            })
        })

        context('when school shortcode is not empty', () => {
            context('and the shortcode is valid', () => {
                it('creates the school', async () => {
                    const school = await createSchool(
                        testClient,
                        organizationId,
                        'some school 1',
                        'myshort1',
                        { authorization: getAdminAuthToken() }
                    )

                    expect(school).not.to.be.null
                    expect(school.shortcode).to.equal('MYSHORT1')
                    const dbSchool = await Organization.findOneOrFail(
                        organizationId
                    )
                    const orgSchools = (await dbSchool.schools) || []
                    expect(orgSchools.map(schoolInfo)).to.deep.eq([
                        school.school_id,
                    ])
                })
            })

            context('and the shortcode is not valid', () => {
                it('fails to create the school', async () => {
                    await expect(
                        createSchool(
                            testClient,
                            organizationId,
                            'some school 1',
                            'myverywrong1',
                            { authorization: getAdminAuthToken() }
                        )
                    ).to.be.rejected
                })
            })
        })

        context('when school name is not empty', () => {
            it('creates the school', async () => {
                const school = await createSchool(
                    testClient,
                    organizationId,
                    'some school 1',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )

                expect(school).not.to.be.null
                expect(school.shortcode?.length).to.equal(10)
                expect(school.shortcode).to.match(/[A-Z|0-9]+/)
                const dbSchool = await Organization.findOneOrFail(
                    organizationId
                )
                const orgSchools = (await dbSchool.schools) || []
                expect(orgSchools.map(schoolInfo)).to.deep.eq([
                    school.school_id,
                ])
            })

            // Unique constraint on School.organization_id/School.school_name has been temporarily removed
            // due to existing duplicates failing the migration
            context.skip(
                'and the school name is duplicated in the same organization',
                () => {
                    let oldSchool: any

                    beforeEach(async () => {
                        oldSchool = await createSchool(
                            testClient,
                            organizationId,
                            'some school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('does not create the school', async () => {
                        const school = await createSchool(
                            testClient,
                            organizationId,
                            'some school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )

                        expect(school).to.be.null
                        const dbSchool = await Organization.findOneOrFail(
                            organizationId
                        )
                        const orgSchools = (await dbSchool.schools) || []
                        expect(orgSchools.map(schoolInfo)).to.deep.eq([
                            oldSchool.school_id,
                        ])
                    })
                }
            )

            context(
                'and the school name is duplicated in different organizations',
                () => {
                    let otherSchool: any

                    beforeEach(async () => {
                        const otherUser = await createNonAdminUser(testClient)
                        const otherUserId = otherUser.user_id
                        const otherOrganization = await createOrganizationAndValidate(
                            testClient,
                            otherUserId,
                            'Other Organization'
                        )
                        const otherOrganizationId =
                            otherOrganization.organization_id
                        otherSchool = await createSchool(
                            testClient,
                            otherOrganizationId,
                            'some school 1',
                            undefined,
                            { authorization: getNonAdminAuthToken() }
                        )
                    })

                    it('creates the school', async () => {
                        const school = await createSchool(
                            testClient,
                            organizationId,
                            'some school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )

                        expect(school).not.to.be.null
                        const dbSchool = await Organization.findOneOrFail(
                            organizationId
                        )
                        const orgSchools = (await dbSchool.schools) || []
                        expect(orgSchools.map(schoolInfo)).to.deep.eq([
                            school.school_id,
                        ])
                        expect(school.school_id).to.not.eq(
                            otherSchool.school_id
                        )
                        expect(school.school_name).to.eq(
                            otherSchool.school_name
                        )
                    })

                    context(
                        'and the organization is marked as inactive',
                        () => {
                            beforeEach(async () => {
                                await deleteOrganization(
                                    testClient,
                                    organization.organization_id,
                                    { authorization: getAdminAuthToken() }
                                )
                            })

                            it('fails to create school in the organization', async () => {
                                const school = await createSchool(
                                    testClient,
                                    organizationId,
                                    'some school 1',
                                    undefined,
                                    { authorization: getAdminAuthToken() }
                                )

                                expect(school).to.be.null
                                const dbSchool = await Organization.findOneOrFail(
                                    organizationId
                                )
                                const orgSchools =
                                    (await dbSchool.schools) || []
                                expect(orgSchools).to.be.empty
                            })
                        }
                    )
                }
            )
            context(
                'and the school shortcode is duplicated in different organizations',
                () => {
                    let otherSchool: any

                    beforeEach(async () => {
                        const otherUser = await createNonAdminUser(testClient)
                        const otherUserId = otherUser.user_id
                        const otherOrganization = await createOrganizationAndValidate(
                            testClient,
                            otherUserId,
                            'Other Organization'
                        )
                        const otherOrganizationId =
                            otherOrganization.organization_id
                        otherSchool = await createSchool(
                            testClient,
                            otherOrganizationId,
                            'some school 1',
                            'ASHORT1',
                            { authorization: getNonAdminAuthToken() }
                        )
                    })

                    it('creates the school', async () => {
                        const school = await createSchool(
                            testClient,
                            organizationId,
                            'some school 2',
                            'ASHORT1',
                            { authorization: getAdminAuthToken() }
                        )

                        expect(school).not.to.be.null
                        const dbSchool = await Organization.findOneOrFail(
                            organizationId
                        )
                        const orgSchools = (await dbSchool.schools) || []
                        expect(orgSchools.map(schoolInfo)).to.deep.eq([
                            school.school_id,
                        ])
                        expect(school.school_id).to.not.eq(
                            otherSchool.school_id
                        )
                        expect(school.shortcode).to.eq(otherSchool.shortcode)
                    })
                }
            )
        })
    })

    describe('membershipSchools', async () => {
        context('when user is a member of an organization', () => {
            let adminUserId: string
            let organizationId: string
            let school: School
            beforeEach(async () => {
                adminUser = await createAdminUser(testClient)
                adminUserId = adminUser.user_id
                organization = await createOrganizationAndValidate(
                    testClient,
                    adminUser.user_id
                )
                organizationId = organization.organization_id
                role = await createRole(
                    testClient,
                    organization.organization_id,
                    'student'
                )
                school = await createSchool(
                    testClient,
                    organizationId,
                    'school 1',
                    undefined,
                    { authorization: getAdminAuthToken() }
                )
                await addUserToOrganizationAndValidate(
                    testClient,
                    adminUserId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should set the school in the schools membership for the user', async () => {
                const [
                    schoolMemberships,
                    oldSchoolMemberships,
                ]: SchoolMembership[][] = await organization[
                    'membershipSchools'
                ](adminUser, [school], new Array(role))
                expect(oldSchoolMemberships).to.exist
                expect(oldSchoolMemberships).to.be.empty
                expect(schoolMemberships).to.exist
                expect(schoolMemberships.length).to.equal(1)
                expect(schoolMemberships[0].user_id).to.equal(adminUserId)
                expect(schoolMemberships[0].school_id).to.equal(
                    school.school_id
                )
            })
        })
    })

    function commonMembershipTests(
        api: (
            args?: Partial<EditMembershipArguments> &
                Partial<InviteUserArguments>,
            organization_id?: string,
            headers?: Headers
        ) => Promise<{ user: User; membership: OrganizationMembership }>
    ) {
        const findSchoolMembership = async (primaryKey: {
            user_id: string
            school_id: string
        }) => {
            return connection
                .getRepository(SchoolMembership)
                .findOneOrFail(primaryKey, { relations: ['roles'] })
        }
        return context('common membership tests', () => {
            context('given_name', () => {
                it('is required by the schema', async () => {
                    return await expect(
                        api({
                            given_name: undefined,
                        })
                    ).to.be.rejectedWith(
                        'Variable "$given_name" of required type "String!" was not provided.'
                    )
                })
            })
            context('family_name', () => {
                it('is required by the schema', async () => {
                    return await expect(
                        api({
                            family_name: undefined,
                        })
                    ).to.be.rejectedWith(
                        'Variable "$family_name" of required type "String!" was not provided.'
                    )
                })
            })
            context('gender', () => {
                it('is required by the schema', async () => {
                    return await expect(
                        api({
                            gender: undefined,
                        })
                    ).to.be.rejectedWith(
                        'Variable "$gender" of required type "String!" was not provided.'
                    )
                })
            })
            context('date_of_birth', () => {
                it('is set on the user', async () => {
                    const date_of_birth = '12-2005'

                    const { user } = await api({
                        date_of_birth,
                    })

                    expect(user.date_of_birth).to.equal(date_of_birth)
                })

                it('is padded if too short', async () => {
                    const { user } = await api({
                        date_of_birth: '6-1994',
                    })

                    expect(user.date_of_birth).to.equal('06-1994')
                })
            })
            context('shortcode', () => {
                it('if provided is saved to the OrganizationMembership', async () => {
                    const shortcode = 'RANGER13'
                    const { membership } = await api({
                        shortcode,
                    })

                    expect(membership.shortcode).to.equal(shortcode)
                })

                it('is normalized to uppercase', async () => {
                    const shortcode = 'lower1'
                    const { membership } = await api({
                        shortcode,
                    })

                    expect(membership.shortcode).to.equal(
                        shortcode.toUpperCase()
                    )
                })

                it('throws an APIError if not alphanumeric', async () => {
                    return await expect(
                        api({
                            shortcode: 'not_alphanumeric',
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.invalid_alphanumeric(
                            e,
                            {
                                entity: 'OrganizationMembership',
                                attribute: 'shortcode',
                            },
                            ['shortcode']
                        )
                    })
                })
            })

            context('organization_role_ids', () => {
                const findOrganizationMembership = async (user_id: string) => {
                    return connection
                        .getRepository(OrganizationMembership)
                        .findOneOrFail(
                            {
                                user_id,
                                organization_id: organization.organization_id,
                            },
                            { relations: ['roles'] }
                        )
                }

                it('is required by the schema', async () => {
                    return await expect(
                        api({
                            organization_role_ids: undefined,
                        })
                    ).to.be.rejectedWith(
                        'Variable "$organization_role_ids" of required type "[ID!]!" was not provided.'
                    )
                })

                it('if is an empty array, throws ERR_MISSING_REQUIRED_ENTITY_ATTRIBUTE', async () => {
                    return await expect(
                        api({
                            organization_role_ids: [],
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.missing_required_entity_attribute(
                            e,
                            {
                                entity: 'OrganizationMembership',
                                attribute: 'roles',
                            },
                            ['organization_role_ids']
                        )
                    })
                })

                it('tolerates duplicate IDs', async () => {
                    const { user } = await api({
                        organization_role_ids: [role.role_id, role.role_id],
                    })

                    const membership = await findOrganizationMembership(
                        user.user_id
                    )

                    expect(
                        (await membership?.roles)?.map((role) => role.role_id)
                    ).to.deep.equal([role.role_id])
                })

                it('accepts system Roles', async () => {
                    const systemRole = await connection
                        .getRepository(Role)
                        .findOneOrFail({ system_role: true })

                    const { user } = await api({
                        organization_role_ids: [systemRole.role_id],
                    })

                    const membership = await findOrganizationMembership(
                        user.user_id
                    )

                    expect(
                        (await membership?.roles)?.map((role) => role.role_id)
                    ).to.deep.equal([systemRole.role_id])
                })

                it('accepts custom Roles', async () => {
                    const customRole = await roleFactory(
                        'Custom',
                        organization
                    ).save()

                    const { user } = await api({
                        organization_role_ids: [customRole.role_id],
                    })

                    const membership = await findOrganizationMembership(
                        user.user_id
                    )

                    expect(
                        (await membership?.roles)?.map((role) => role.role_id)
                    ).to.deep.equal([customRole.role_id])
                })

                it("returns an APIError if the Role doesn't exist", async () => {
                    const nonexistentRoleId = faker.datatype.uuid()
                    return await expect(
                        api({
                            organization_role_ids: [nonexistentRoleId],
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.nonexistent_child(
                            e,
                            {
                                entity: 'Role',
                                entityName: nonexistentRoleId,
                                parentEntity: 'Organization',
                                parentName: organization.organization_name!,
                            },
                            ['organization_role_ids']
                        )
                    })
                })

                it("returns an APIError if the Role doesn't exist on this Organization", async () => {
                    const otherOrg = await createOrganization().save()

                    const otherRole = await roleFactory(
                        'New Custom Role',
                        otherOrg
                    ).save()
                    return await expect(
                        api({
                            organization_role_ids: [otherRole.role_id],
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.nonexistent_child(
                            e,
                            {
                                entity: 'Role',
                                entityName: otherRole.role_id,
                                parentEntity: 'Organization',
                                parentName: organization.organization_name!,
                            },
                            ['organization_role_ids']
                        )
                    })
                })
            })
            context('school_role_ids', () => {
                let school: School
                beforeEach(async () => {
                    school = await schoolFactory(organization).save()
                })

                it('has no effect if not provided with school_ids', async () => {
                    const { user } = await api({
                        school_role_ids: [role.role_id],
                    })

                    expect(user).to.exist
                    return await expect(
                        findSchoolMembership({
                            user_id: user.user_id,
                            school_id: school.school_id,
                        })
                    ).to.be.rejectedWith(EntityNotFoundError)
                })

                it('tolerates duplicate IDs', async () => {
                    const { user } = await api({
                        school_role_ids: [role.role_id, role.role_id],
                        school_ids: [school.school_id],
                    })

                    const membership = await findSchoolMembership({
                        user_id: user.user_id,
                        school_id: school.school_id,
                    })

                    expect(
                        (await membership?.roles)?.map((role) => role.role_id)
                    ).to.deep.equal([role.role_id])
                })

                it('accepts system Roles', async () => {
                    const systemRole = await connection
                        .getRepository(Role)
                        .findOneOrFail({ system_role: true })
                    const { user } = await api({
                        school_role_ids: [systemRole.role_id],
                        school_ids: [school.school_id],
                    })

                    const membership = await findSchoolMembership({
                        user_id: user.user_id,
                        school_id: school.school_id,
                    })

                    expect(await membership?.roles).to.deep.equal([systemRole])
                })

                it('accepts custom Roles', async () => {
                    const customRole = await roleFactory(
                        'Custom',
                        organization
                    ).save()
                    const { user } = await api({
                        school_role_ids: [customRole.role_id],
                        school_ids: [school.school_id],
                    })

                    const membership = await findSchoolMembership({
                        user_id: user.user_id,
                        school_id: school.school_id,
                    })

                    expect(
                        (await membership?.roles)?.map(
                            (role) => (role as Role).role_id
                        )
                    ).to.deep.equal([customRole.role_id])
                })

                it("returns an APIError if the Role doesn't exist", async () => {
                    const nonexistentRoleId = faker.datatype.uuid()
                    return await expect(
                        api({
                            school_role_ids: [nonexistentRoleId],
                            school_ids: [school.school_id],
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.nonexistent_child(
                            e,
                            {
                                entity: 'Role',
                                entityName: nonexistentRoleId,
                                parentEntity: 'Organization',
                                parentName: organization.organization_name!,
                            },
                            ['school_role_ids']
                        )
                    })
                })

                it("returns an APIError if the Role doesn't exist on this Organization", async () => {
                    const otherOrg = await createOrganization().save()

                    const otherRole = await roleFactory(
                        'New Custom Role',
                        otherOrg
                    ).save()
                    return await expect(
                        api({
                            school_role_ids: [otherRole.role_id],
                            school_ids: [school.school_id],
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.nonexistent_child(
                            e,
                            {
                                entity: 'Role',
                                entityName: otherRole.role_id,
                                parentEntity: 'Organization',
                                parentName: organization.organization_name!,
                            },
                            ['school_role_ids']
                        )
                    })
                })
            })
            context('school_ids', () => {
                let school: School

                beforeEach(async () => {
                    school = await schoolFactory(organization).save()
                })

                it('creates an active SchoolMembership for each school', async () => {
                    const otherSchool = await schoolFactory(organization).save()

                    const { user } = await api({
                        school_ids: [school.school_id, otherSchool.school_id],
                    })

                    const memberships = await Promise.all([
                        findSchoolMembership({
                            user_id: user.user_id,
                            school_id: school.school_id,
                        }),
                        findSchoolMembership({
                            user_id: user.user_id,
                            school_id: otherSchool.school_id,
                        }),
                    ])

                    memberships.forEach((membership) => {
                        expect(membership.status).to.equal(Status.ACTIVE)
                        expect(membership.deleted_at).to.be.null
                    })
                })
            })

            context('alternate_email', () => {
                it('if invalid throws an ERR_INVALID_EMAIL APIError', async () => {
                    return await expect(
                        api({
                            alternate_email: 'not-a-valid-email',
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.invalid_email(
                            e,
                            {
                                entity: 'User',
                                attribute: 'alternate_email',
                            },
                            ['alternate_email']
                        )
                    })
                })

                it('is normalized', async () => {
                    const alternate_email = 'cafe\u0301@gmail.com'

                    const { user } = await api({
                        alternate_email,
                    })

                    expect(user.alternate_email).to.equal('caf\u00E9@gmail.com')
                })

                it('is trimmed', async () => {
                    const alternate_email = `${faker.internet
                        .email()
                        .toLowerCase()}  `

                    const { user } = await api({
                        alternate_email,
                    })

                    expect(user.alternate_email).to.equal(
                        alternate_email.trim()
                    )
                })

                it('is lowercased', async () => {
                    const alternate_email = faker.internet.email()

                    const { user } = await api({
                        alternate_email: alternate_email.toUpperCase(),
                    })

                    expect(user.alternate_email).to.equal(
                        alternate_email.toLowerCase()
                    )
                })

                it('if valid is saved to the User entity', async () => {
                    const alternate_email = faker.internet.email().toLowerCase()
                    const { user } = await api({
                        alternate_email,
                    })

                    expect(user.alternate_email).to.equal(alternate_email)
                })
                ;[null, ''].forEach((alternate_email) => {
                    it(`if ${alternate_email}, is normalised to null`, async () => {
                        const { user } = await api({
                            alternate_email,
                        })

                        expect(user.alternate_email).to.be.null
                    })
                })
            })
            context('alternate_phone', () => {
                it('if invalid throws an ERR_INVALID_PHONE APIError', async () => {
                    return await expect(
                        api({
                            alternate_phone: 'not-a-valid-phone',
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.invalid_phone(
                            e,
                            {
                                entity: 'User',
                                attribute: 'alternate_phone',
                            },
                            ['alternate_phone']
                        )
                    })
                })

                it('gets rid of 0 after country code', async () => {
                    const result = await api({
                        alternate_phone: '+8201071111111',
                    })

                    expect(result.user.alternate_phone).to.eq('+821071111111')
                })

                it('if valid is saved to the User entity', async () => {
                    const alternate_phone = faker.phone.phoneNumber(
                        '+447######'
                    )
                    const { user } = await api({
                        alternate_phone,
                    })

                    expect(user.alternate_phone).to.equal(alternate_phone)
                })
                ;[null, ''].forEach((alternate_phone) => {
                    it(`if ${alternate_phone}, is normalised to null`, async () => {
                        const { user } = await api({
                            alternate_phone,
                        })

                        expect(user.alternate_phone).to.be.null
                    })
                })
            })
        })
    }

    describe('inviteUser', () => {
        let organizationId: string
        let oldSchoolId: string
        let adminToken: string
        let defaultArguments: InviteUserArguments

        const inviteUserWithDefaults = async (
            overrideArguments?: Partial<InviteUserArguments>,
            organization_id?: string,
            headers?: Headers
        ) => {
            const args = {
                ...defaultArguments,
                ...overrideArguments,
            }

            return await inviteUser(
                testClient,
                organization_id ?? organizationId,
                args.email,
                args.phone,
                args.given_name,
                args.family_name,
                args.date_of_birth,
                args.username,
                args.gender,
                args.shortcode,
                args.organization_role_ids,
                args.school_ids,
                args.school_role_ids,
                headers ?? { authorization: adminToken },
                args.alternate_email,
                args.alternate_phone
            )
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            adminToken = generateToken(userToPayload(adminUser))
            await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                adminUser.user_id
            )
            organizationId = organization.organization_id
            role = await Role.findOneOrFail({
                where: { role_name: 'Student' },
            })
            oldSchoolId = (
                await createSchool(
                    testClient,
                    organizationId,
                    'school 1',
                    undefined,
                    { authorization: adminToken }
                )
            ).school_id
            await addUserToSchool(testClient, adminUser.user_id, oldSchoolId, {
                authorization: adminToken,
            })
            defaultArguments = {
                given_name: validUser.given_name,
                family_name: validUser.family_name,
                email: validUser.email,
                gender: validUser.gender,
                organization_role_ids: [role.role_id],
            }
        })

        context('no existing user with the same email/phone', () => {
            context('email', () => {
                it('creates the user when email provided', async () => {
                    const email = 'bob@nowhere.com'
                    const { user } = await inviteUserWithDefaults({ email })

                    expect(user).to.exist
                    expect(user?.email).to.equal(email)
                })

                it('normalises the email to lowercase', async () => {
                    const email = 'Bob.Dylan@NOWHERE.com'

                    const { user } = await inviteUserWithDefaults({ email })

                    expect(user).to.exist
                    expect(user?.email).to.equal(email.toLowerCase())
                })

                it('swaps a valid email in the `phone` field to `email`', async () => {
                    const email = 'bob.dylan@nowhere.com'

                    const { user } = await inviteUserWithDefaults({
                        phone: email,
                        email: undefined,
                    })

                    expect(user).to.exist
                    expect(user.email).to.eq(email)
                    expect(user.phone).to.be.null
                })
            })

            context('phone', () => {
                it('creates the user when phone provided', async () => {
                    const phone = '+44207344141'

                    const { user } = await inviteUserWithDefaults({
                        phone,
                        email: undefined,
                    })

                    expect(user).to.exist
                    expect(user.phone).to.equal(phone)
                    expect(user?.email).to.be.null
                })

                it('swaps a valid phone in the `email` field to `phone`', async () => {
                    const phone = '+44207344141'

                    const { user } = await inviteUserWithDefaults({
                        email: phone,
                        phone: undefined,
                    })

                    expect(user).to.exist
                    expect(user.phone).to.equal(phone)
                    expect(user?.email).to.be.null
                })
                it('gets rid of 0 after country code', async () => {
                    const result = await inviteUserWithDefaults({
                        phone: '+8201071111111',
                    })

                    expect(result.user.phone).to.eq('+821071111111')
                })
                ;[null, ''].forEach((phone) => {
                    it(`if ${phone}, is normalised to null`, async () => {
                        const { user } = await inviteUserWithDefaults({
                            phone,
                        })

                        expect(user.phone).to.be.null
                    })
                })
            })

            context('shortcode', () => {
                it('defaults to an autogenerated shortcode', async () => {
                    const { membership } = await inviteUserWithDefaults({
                        shortcode: undefined,
                    })

                    expect(membership.shortcode).to.be.a('string')
                    expect(membership.shortcode).to.match(shortcode_re)
                })
            })

            commonMembershipTests(inviteUserWithDefaults)

            context('required fields', () => {
                it('creates the User when only the required fields are provided', async () => {
                    const { user, membership } = await inviteUserWithDefaults()

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.shortcode).not.to.equal('')

                    expect(user?.gender).to.equal(defaultArguments.gender)
                    expect(user?.given_name).to.equal(
                        defaultArguments.given_name
                    )
                    expect(user?.family_name).to.equal(
                        defaultArguments.family_name
                    )
                    expect(user?.email).to.equal(defaultArguments.email)
                })

                it('if email AND phone is missing throws ERR_MISSING_REQUIRED_EITHER', async () => {
                    return expect(
                        inviteUserWithDefaults({
                            email: undefined,
                            phone: undefined,
                        })
                    ).to.be.rejected.then((e) => {
                        expectAPIError.missing_required_either(
                            e,
                            {
                                entity: 'User',
                                attribute: 'email',
                                otherAttribute: 'Phone',
                            },
                            ['email']
                        )
                    })
                })
            })

            it('creates the user makes them linked to organization, they invite someone else', async () => {
                const { user, membership } = await inviteUserWithDefaults()

                expect(user).to.exist
                expect(membership.organization_id).to.equal(organizationId)

                const newUserToken = generateToken(userToPayload(user))

                const otherEmail = 'bob2@nowhere.com'
                const {
                    user: otherUser,
                    membership: otherMembership,
                } = await inviteUserWithDefaults(
                    { email: otherEmail },
                    undefined,
                    { authorization: newUserToken }
                )

                expect(otherUser).to.exist
                expect(otherUser?.email).to.equal(otherEmail)
                expect(otherMembership.organization_id).to.equal(organizationId)
            })

            context('and the organization is marked as inactive', () => {
                beforeEach(async () => {
                    await deleteOrganization(
                        testClient,
                        organization.organization_id,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('fails to invite user to the organization', async () => {
                    const gqlresult = await inviteUserWithDefaults()

                    expect(gqlresult).to.be.null

                    const dbOrganization = await Organization.findOneOrFail({
                        where: { organization_id: organizationId },
                    })
                    const organizationMemberships = await dbOrganization.memberships
                    const dbOrganizationMembership = await OrganizationMembership.findOneOrFail(
                        {
                            where: {
                                organization_id: organizationId,
                                user_id: adminUser.user_id,
                            },
                        }
                    )

                    expect(organizationMemberships).to.deep.include(
                        dbOrganizationMembership
                    )
                })
            })
        })

        context('existing user with the same', () => {
            let existingUser: User
            let existingMembership: OrganizationMembership
            beforeEach(async () => {
                const response = await inviteUserWithDefaults({
                    date_of_birth: '01-2000',
                    alternate_email: 'joe@gmail.com',
                    alternate_phone: '+44102938475600',
                })

                existingUser = response.user
                existingMembership = response.membership
            })

            async function expectTotalUsersWithEmail(expectedCount: number) {
                const actualCount = await connection.getRepository(User).count({
                    email: defaultArguments.email as string | undefined,
                })

                expect(actualCount).to.equal(expectedCount)
            }

            context('given_name/family_name and email/phone', () => {
                context('in the same Organization', () => {
                    it('throws an APIError if given_name/family_name/email are the same', async () => {
                        return expect(
                            inviteUserWithDefaults({
                                given_name: existingUser.given_name,
                                family_name: existingUser.family_name,
                                email: existingUser.email,
                            })
                        ).to.be.rejected.then((e) => {
                            expectToBeAPIErrorCollection(e, [
                                {
                                    code: 'ERR_DUPLICATE_CHILD_ENTITY',
                                    message:
                                        'User Joe Bloggs already exists for Organization My Organization.',
                                    variables: [
                                        'email',
                                        'phone',
                                        'given_name',
                                        'family_name',
                                    ],
                                    entity: 'User',
                                    entityName: 'Joe Bloggs',
                                    parentEntity: 'Organization',
                                    parentName: 'My Organization',
                                },
                            ])
                        })
                    })

                    it('throws an APIError if given_name/family_name/phone are the same', async () => {
                        const existingPhone = '+4427892347890'
                        await getRepository(User).update(existingUser.user_id, {
                            phone: existingPhone,
                        })
                        return expect(
                            inviteUserWithDefaults({
                                given_name: existingUser.given_name,
                                family_name: existingUser.family_name,
                                email: undefined,
                                phone: existingPhone,
                            })
                        ).to.be.rejected.then((e) => {
                            expectToBeAPIErrorCollection(e, [
                                {
                                    code: 'ERR_DUPLICATE_CHILD_ENTITY',
                                    message:
                                        'User Joe Bloggs already exists for Organization My Organization.',
                                    variables: [
                                        'email',
                                        'phone',
                                        'given_name',
                                        'family_name',
                                    ],
                                    entity: 'User',
                                    entityName: 'Joe Bloggs',
                                    parentEntity: 'Organization',
                                    parentName: 'My Organization',
                                },
                            ])
                        })
                    })

                    Object.entries({
                        given_name: 'Joanne',
                        family_name: 'Smith',
                    }).forEach(([key, value]) => {
                        it(`creates a new User if the ${key} is different`, async () => {
                            const { user } = await inviteUserWithDefaults({
                                [key]: value,
                            })

                            expect(user).to.exist
                            expect(user?.[key as keyof User]).to.equal(value)
                            expect(user.user_id).not.to.equal(
                                existingUser.user_id
                            )
                        })
                    })

                    it(`creates a new User if the email is different`, async () => {
                        const email = 'joanne@hotmail.com'
                        const { user } = await inviteUserWithDefaults({
                            email,
                        })

                        expect(user).to.exist
                        expect(user?.email).to.equal(email)
                        expect(user.user_id).not.to.equal(existingUser.user_id)
                    })

                    it(`creates a new User if the phone is different`, async () => {
                        const phone = '+44234789768234'
                        const { user } = await inviteUserWithDefaults({
                            email: undefined,
                            phone,
                        })

                        expect(user).to.exist
                        expect(user?.phone).to.equal(phone)
                        expect(user.user_id).not.to.equal(existingUser.user_id)
                    })
                })

                context('in another Organization', () => {
                    let otherOrg: Organization
                    beforeEach(async () => {
                        otherOrg = await createOrganization().save()
                    })
                    it('creates a new OrganizationMembership for the existing User', async () => {
                        const {
                            user,
                            membership,
                        } = await inviteUserWithDefaults(
                            undefined,
                            otherOrg.organization_id
                        )

                        expect(user).to.exist
                        expect(user.user_id).to.equal(existingUser.user_id)
                        expect(membership.organization_id).to.equal(
                            otherOrg.organization_id
                        )

                        const dbUser = await getRepository(User).findOneOrFail(
                            user.user_id
                        )

                        expect(dbUser.alternate_email).to.equal(
                            existingUser.alternate_email
                        )
                        expect(dbUser.alternate_phone).to.equal(
                            existingUser.alternate_phone
                        )
                        expect(dbUser.gender).to.equal(existingUser.gender)
                        expect(dbUser.date_of_birth).to.equal(
                            existingUser.date_of_birth
                        )

                        await expectTotalUsersWithEmail(1)
                    })

                    it('overwrites gender/date_of_birth/alternate_email/alternate_phone if specified', async () => {
                        const updatedUserInfo = {
                            gender: 'New',
                            date_of_birth: '05-1964',
                            alternate_email: 'jo.smith@hotmail.com',
                            alternate_phone: '+44987654321123',
                        }
                        const {
                            user,
                            membership,
                        } = await inviteUserWithDefaults(
                            updatedUserInfo,
                            otherOrg.organization_id
                        )
                        expect(user).to.exist
                        expect(user.user_id).to.equal(existingUser.user_id)
                        expect(membership.organization_id).to.equal(
                            otherOrg.organization_id
                        )

                        const dbUser = await getRepository(User).findOneOrFail(
                            user.user_id
                        )

                        expect(dbUser.alternate_email).to.equal(
                            updatedUserInfo.alternate_email
                        )
                        expect(dbUser.alternate_phone).to.equal(
                            updatedUserInfo.alternate_phone
                        )
                        expect(dbUser.gender).to.equal(updatedUserInfo.gender)
                        expect(dbUser.date_of_birth).to.equal(
                            updatedUserInfo.date_of_birth
                        )

                        await expectTotalUsersWithEmail(1)
                    })
                })
            })

            context('shortcode', () => {
                context('in the same Organization', () => {
                    it('throws an APIError', async () => {
                        return expect(
                            inviteUserWithDefaults({
                                family_name: 'Different',
                                shortcode: existingMembership.shortcode,
                            })
                        ).to.be.rejected.then((e) => {
                            expectToBeAPIErrorCollection(e, [
                                {
                                    code: 'ERR_DUPLICATE_CHILD_ENTITY',
                                    message: `OrganizationMembership ${existingMembership.shortcode} already exists for Organization My Organization.`,
                                    variables: ['shortcode'],
                                    entity: 'OrganizationMembership',
                                    entityName: existingMembership.shortcode,
                                    parentEntity: 'Organization',
                                    parentName: 'My Organization',
                                },
                            ])
                        })
                    })
                })

                context('in another Organization', () => {
                    it('creates the User', async () => {
                        const otherOrg = await createOrganization().save()

                        const { membership } = await inviteUserWithDefaults(
                            { shortcode: existingMembership.shortcode },
                            otherOrg.organization_id
                        )

                        expect(membership.shortcode).to.equal(
                            existingMembership.shortcode
                        )
                        expect(membership.organization_id).to.equal(
                            otherOrg.organization_id
                        )
                    })
                })
            })
        })
    })
    describe('editMembership', async () => {
        let defaultArguments: EditMembershipArguments
        let existingUser: User
        let existingMembership: OrganizationMembership
        let token: string

        beforeEach(async () => {
            organization = await createOrganization().save()

            existingUser = await userFactory({
                alternate_email: faker.internet.email(),
                alternate_phone: faker.phone.phoneNumber('+44#######'),
            }).save()

            token = generateToken(userToPayload(existingUser))

            existingMembership = await createOrganizationMembership({
                user: existingUser,
                organization,
            }).save()

            role = await roleFactory(undefined, organization).save()

            await createQueryBuilder(Role)
                .relation('permissions')
                .of(role)
                .add(PermissionName.edit_users_40330)

            await createQueryBuilder(OrganizationMembership)
                .relation('roles')
                .of(existingMembership)
                .add(role)

            const studentRole = await Role.findOneOrFail({
                role_name: 'Student',
                system_role: true,
            })

            defaultArguments = {
                user_id: existingUser.user_id,
                given_name: validUser.given_name,
                family_name: validUser.family_name,
                gender: validUser.gender,
                organization_role_ids: [studentRole.role_id],
                shortcode: 'SH0RTC0D3',
            }
        })

        async function editMembershipWithDefaults(
            overrideArguments?: Partial<EditMembershipArguments>,
            organization_id?: string,
            headers?: Headers
        ) {
            const args = {
                ...defaultArguments,
                ...overrideArguments,
            }

            return await editMembership(
                testClient,
                organization_id ?? organization.organization_id,
                args,
                headers ?? { authorization: token }
            )
        }

        async function expectNoChange() {
            const userKeys = [
                'user_id',
                'given_name',
                'family_name',
                'email',
                'phone',
                'username',
                'date_of_birth',
                'gender',
            ] as (keyof User)[]
            const originalUserState = pick(existingUser, userKeys)
            const membershipKeys = [
                'user_id',
                'organization_id',
                'shortcode',
                'join_timestamp',
                'status',
            ] as (keyof OrganizationMembership)[]
            const originalMembershipState = pick(
                existingMembership,
                membershipKeys
            )

            await existingUser.reload()
            await existingMembership.reload()

            expect(pick(existingUser, userKeys)).to.deep.equal(
                originalUserState
            )
            expect(pick(existingMembership, membershipKeys)).to.deep.equal(
                originalMembershipState
            )
        }

        commonMembershipTests(editMembershipWithDefaults)

        context('authentication', async () => {
            it("if the User doesn't have `edit_users_40330`permission throws an error", async () => {
                await createQueryBuilder(Role)
                    .relation('permissions')
                    .of(role)
                    .remove(PermissionName.edit_users_40330)

                return expect(editMembershipWithDefaults())
                    .to.be.rejectedWith(
                        `User(${existingUser.user_id}) does not have Permission(edit_users_40330) in Organizations(${organization.organization_id})`
                    )
                    .then(async () => {
                        await expectNoChange()
                    })
            })
        })
        context('organization', async () => {
            it('if the Organization is inactive makes no update and returns null', async () => {
                await Organization.update(organization.organization_id, {
                    status: Status.INACTIVE,
                })

                const result = await editMembershipWithDefaults()

                expect(result).to.be.null

                await expectNoChange()
            })
        })
        context('user_id', () => {
            it("if the `user_id` doesn't exist throws ERR_NONEXISTENT_ENTITY APIError", async () => {
                const user_id = faker.datatype.uuid()
                return expect(
                    editMembershipWithDefaults({ user_id })
                ).to.be.rejected.then((e) => {
                    expectAPIError.nonexistent_entity(
                        e,
                        {
                            entity: 'User',
                            entityName: user_id,
                        },
                        ['user_id']
                    )
                })
            })

            it('if the `user_id` exists, but has no membership for the chosen Organization, throws ERR_NONEXISTENT_CHILD_ENTITY APIError', async () => {
                // We need to create another user belonging to this Organization, so we can get past the permission checks
                await OrganizationMembership.delete(
                    OrganizationMembership.getId(existingMembership)
                )
                const adminUser = await adminUserFactory().save()

                return expect(
                    editMembershipWithDefaults(undefined, undefined, {
                        authorization: generateToken(userToPayload(adminUser)),
                    })
                ).to.be.rejected.then(async (e) => {
                    expectAPIError.nonexistent_child(
                        e,
                        {
                            entity: 'User',
                            entityName: existingUser.full_name(),
                            parentEntity: 'Organization',
                            parentName: organization.organization_name!,
                        },
                        ['user_id', 'organization_id']
                    )
                })
            })

            it('is required by the schema', async () => {
                return expect(
                    editMembershipWithDefaults({
                        user_id: undefined,
                    })
                )
                    .to.be.rejectedWith(
                        'Variable "$user_id" of required type "ID!" was not provided.'
                    )
                    .then(async () => {
                        await expectNoChange()
                    })
            })
        })
        context('organization_role_ids', () => {
            it('removes any old Roles', async () => {
                const oldRole = await roleFactory(
                    undefined,
                    organization
                ).save()

                await OrganizationMembership.createQueryBuilder()
                    .relation('roles')
                    .of(existingMembership)
                    .add(oldRole)

                await editMembershipWithDefaults({
                    organization_role_ids: [role.role_id],
                })

                await existingMembership.reload()

                expect(
                    (await existingMembership.roles)?.map(
                        (role) => role.role_id
                    )
                ).to.deep.equal([role.role_id])
            })
        })
        context('school_ids', () => {
            let school: School

            beforeEach(async () => {
                school = await schoolFactory(organization).save()
            })

            it('removes any old SchoolMemberships', async () => {
                const otherSchool = await schoolFactory(organization).save()
                await createSchoolMembership({
                    user: existingUser,
                    school: otherSchool,
                }).save()

                await editMembershipWithDefaults({
                    school_ids: [school.school_id],
                })

                expect(
                    (
                        await SchoolMembership.find({
                            user_id: existingUser.user_id,
                        })
                    ).map((membership) => membership.school_id)
                ).to.deep.equal([school.school_id])
            })

            it('does not clobber SchoolMemberships for another Organization', async () => {
                const otherOrganization = await createOrganization().save()
                await createOrganizationMembership({
                    user: existingUser,
                    organization: otherOrganization,
                }).save()
                const otherSchool = await schoolFactory(
                    otherOrganization
                ).save()
                await createSchoolMembership({
                    user: existingUser,
                    school: otherSchool,
                }).save()

                await editMembershipWithDefaults({
                    school_ids: [school.school_id],
                })

                const memberships = await SchoolMembership.find({
                    where: {
                        user_id: existingUser.user_id,
                        status: Status.ACTIVE,
                    },
                })
                expect(
                    memberships.map((membership) => membership.school_id)
                ).to.deep.equalInAnyOrder([
                    school.school_id,
                    otherSchool.school_id,
                ])
            })
        })
        context('shortcode', () => {
            it('is required by the schema', async () => {
                return expect(
                    editMembershipWithDefaults({ shortcode: undefined })
                )
                    .to.be.rejectedWith(
                        'Variable "$shortcode" of required type "String!" was not provided.'
                    )
                    .then(async () => {
                        await expectNoChange()
                    })
            })
            it('if empty string throws an ERR_INVALID_REQUIRED_ATTRIBUTE APIError', async () => {
                return expect(
                    editMembershipWithDefaults({ shortcode: '' })
                ).to.be.rejected.then((e) => {
                    expectAPIError.missing_required_entity_attribute(
                        e,
                        {
                            entity: 'OrganizationMembership',
                            attribute: 'shortcode',
                        },
                        ['shortcode']
                    )
                })
            })
        })
        context('alternate_email', () => {
            it('if undefined does not overwrite the existing alternate_email', async () => {
                const existingAlternateEmail = existingUser.alternate_email

                expect(existingAlternateEmail)
                    .to.be.a('string')
                    .and.not.to.equal('')

                await editMembershipWithDefaults({
                    alternate_email: undefined,
                })

                await existingUser.reload()

                expect(existingUser.alternate_email).to.equal(
                    existingAlternateEmail
                )
            })
        })
        context('alternate_phone', () => {
            it('if undefined does not overwrite the existing alternate_phone', async () => {
                const existingAlternatePhone = existingUser.alternate_phone

                expect(existingAlternatePhone)
                    .to.be.a('string')
                    .and.not.to.equal('')

                await editMembershipWithDefaults({
                    alternate_phone: undefined,
                })

                await existingUser.reload()

                expect(existingUser.alternate_phone).to.equal(
                    existingAlternatePhone
                )
            })
        })
    })

    describe('delete', () => {
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
            const school = await createSchool(
                testClient,
                organizationId,
                'school',
                undefined,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            it('fails to delete the organization', async () => {
                await expect(
                    deleteOrganization(
                        testClient,
                        organization.organization_id,
                        { authorization: undefined }
                    )
                ).to.be.rejected

                const dbOrganization = await Organization.findOneOrFail(
                    organization.organization_id
                )
                expect(dbOrganization.status).to.eq(Status.ACTIVE)
                expect(dbOrganization.deleted_at).to.be.null
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have delete organization permissions',
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

                    it('fails to delete the organization', async () => {
                        await expect(
                            deleteOrganization(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbOrganization = await Organization.findOneOrFail(
                            organization.organization_id
                        )
                        expect(dbOrganization.status).to.eq(Status.ACTIVE)
                        expect(dbOrganization.deleted_at).to.be.null
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
                        PermissionName.delete_organization_10440,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('deletes the organization', async () => {
                    const gqlOrganization = await deleteOrganization(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlOrganization).to.be.true
                    const dbOrganization = await Organization.findOneOrFail(
                        organization.organization_id
                    )
                    expect(dbOrganization.status).to.eq(Status.INACTIVE)
                    expect(dbOrganization.deleted_at).not.to.be.null
                })

                it('deletes the organization memberships', async () => {
                    const gqlOrganization = await deleteOrganization(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlOrganization).to.be.true
                    const dbOrganization = await Organization.findOneOrFail(
                        organization.organization_id
                    )
                    const dbOrganizationMemberships = await OrganizationMembership.find(
                        {
                            where: {
                                organization_id: organization.organization_id,
                            },
                        }
                    )
                    expect(dbOrganizationMemberships).to.satisfy(
                        (memberships: OrganizationMembership[]) => {
                            return memberships.every(
                                (membership) =>
                                    membership.status === Status.INACTIVE
                            )
                        }
                    )
                })

                it('deletes the organization schools', async () => {
                    const gqlOrganization = await deleteOrganization(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlOrganization).to.be.true
                    const dbOrganization = await Organization.findOneOrFail(
                        organization.organization_id
                    )
                    const dbSchools = (await dbOrganization.schools) || []

                    expect(dbSchools).to.satisfy((schools: School[]) => {
                        return schools.every(
                            (school) => school.status === Status.INACTIVE
                        )
                    })
                })

                it('deletes the organization ownership', async () => {
                    const gqlOrganization = await deleteOrganization(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlOrganization).to.be.true
                    const dbOrganization = await Organization.findOneOrFail(
                        organization.organization_id
                    )
                    const dbOrganizationOwnership = await OrganizationOwnership.findOneOrFail(
                        {
                            where: {
                                organization_id: organization.organization_id,
                            },
                        }
                    )
                    expect(dbOrganizationOwnership.status).to.eq(
                        Status.INACTIVE
                    )
                })

                context('and the organization is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteOrganization(
                            testClient,
                            organization.organization_id,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('fails to delete the organization', async () => {
                        const gqlOrganization = await deleteOrganization(
                            testClient,
                            organization.organization_id,
                            { authorization: getNonAdminAuthToken() }
                        )
                        expect(gqlOrganization).to.be.null
                        const dbOrganization = await Organization.findOneOrFail(
                            organization.organization_id
                        )
                        expect(dbOrganization.status).to.eq(Status.INACTIVE)
                        expect(dbOrganization.deleted_at).not.to.be.null
                    })
                })
            })
        })
    })

    describe('createOrUpdateAgeRanges', () => {
        let user: User
        let organization: Organization
        let ageRange: AgeRange

        const ageRangeInfo = (ageRange: AgeRange) => {
            return {
                name: ageRange.name,
                high_value: ageRange.high_value,
                high_value_unit: ageRange.high_value_unit,
                low_value: ageRange.low_value,
                low_value_unit: ageRange.low_value_unit,
                system: ageRange.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            ageRange = createAgeRange(organization)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            context('and it tries to create new age ranges', () => {
                it('fails to create age ranges in the organization', async () => {
                    await expect(
                        createOrUpdateAgeRanges(
                            testClient,
                            organization.organization_id,
                            [ageRangeInfo(ageRange)],
                            { authorization: undefined }
                        )
                    ).to.be.rejected

                    const dbAgeRanges = await AgeRange.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    expect(dbAgeRanges).to.be.empty
                })
            })

            context(
                'and it tries to update existing non system age ranges',
                () => {
                    let newAgeRange: any

                    beforeEach(async () => {
                        const gqlAgeRanges = await createOrUpdateAgeRanges(
                            testClient,
                            organization.organization_id,
                            [ageRangeInfo(ageRange)],
                            { authorization: getAdminAuthToken() }
                        )

                        newAgeRange = {
                            ...ageRangeInfo(ageRange),
                            ...{ id: gqlAgeRanges[0].id, name: 'New Name' },
                        }
                    })

                    it('fails to update age ranges in the organization', async () => {
                        await expect(
                            createOrUpdateAgeRanges(
                                testClient,
                                organization.organization_id,
                                [newAgeRange],
                                { authorization: undefined }
                            )
                        ).to.be.rejected

                        const dbAgeRanges = await AgeRange.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })

                        expect(dbAgeRanges).not.to.be.empty
                        expect(dbAgeRanges.map(ageRangeInfo)).to.deep.eq(
                            [ageRange].map(ageRangeInfo)
                        )
                    })
                }
            )
        })

        context('when authenticated', () => {
            context(
                'and the user does not have create age range permissions',
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

                    context('and it tries to create new age ranges', () => {
                        it('fails to create age ranges in the organization', async () => {
                            await expect(
                                createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [ageRangeInfo(ageRange)],
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected

                            const dbAgeRanges = await AgeRange.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })
                            expect(dbAgeRanges).to.be.empty
                        })
                    })
                }
            )

            context(
                'and the user does not have edit age range permissions',
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

                    context(
                        'and it tries to update existing non system age ranges',
                        () => {
                            let newAgeRange: any

                            beforeEach(async () => {
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [ageRangeInfo(ageRange)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newAgeRange = {
                                    ...ageRangeInfo(ageRange),
                                    ...{
                                        id: gqlAgeRanges[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update age ranges in the organization', async () => {
                                await expect(
                                    createOrUpdateAgeRanges(
                                        testClient,
                                        organization.organization_id,
                                        [newAgeRange],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbAgeRanges = await AgeRange.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbAgeRanges).not.to.be.empty
                                expect(
                                    dbAgeRanges.map(ageRangeInfo)
                                ).to.deep.eq([ageRange].map(ageRangeInfo))
                            })
                        }
                    )
                }
            )

            context('and is a non admin user', () => {
                context('and the user has all the permissions', () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.create_age_range_20222,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_age_range_20332,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    context('and it tries to create new age ranges', () => {
                        it('creates all the age ranges in the organization', async () => {
                            const gqlAgeRanges = await createOrUpdateAgeRanges(
                                testClient,
                                organization.organization_id,
                                [ageRangeInfo(ageRange)],
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbAgeRanges = await AgeRange.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbAgeRanges).not.to.be.empty
                            expect(dbAgeRanges.map(ageRangeInfo)).to.deep.eq(
                                gqlAgeRanges.map(ageRangeInfo)
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system age ranges',
                        () => {
                            let newAgeRange: any

                            beforeEach(async () => {
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [ageRangeInfo(ageRange)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newAgeRange = {
                                    ...ageRangeInfo(ageRange),
                                    ...{
                                        id: gqlAgeRanges[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected age ranges in the organization', async () => {
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [newAgeRange],
                                    {
                                        authorization: getNonAdminAuthToken(),
                                    }
                                )

                                const dbAgeRanges = await AgeRange.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbAgeRanges).not.to.be.empty
                                expect(
                                    dbAgeRanges.map(ageRangeInfo)
                                ).to.deep.eq([newAgeRange].map(ageRangeInfo))
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system age ranges',
                        () => {
                            let newAgeRange: any

                            beforeEach(async () => {
                                ageRange.system = true
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [ageRangeInfo(ageRange)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newAgeRange = {
                                    ...ageRangeInfo(ageRange),
                                    ...{
                                        id: gqlAgeRanges[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update age ranges in the organization', async () => {
                                await expect(
                                    createOrUpdateAgeRanges(
                                        testClient,
                                        organization.organization_id,
                                        [newAgeRange],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbAgeRanges = await AgeRange.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbAgeRanges).not.to.be.empty
                                expect(
                                    dbAgeRanges.map(ageRangeInfo)
                                ).to.deep.eq([ageRange].map(ageRangeInfo))
                            })
                        }
                    )
                })
            })

            context('and is an admin user', () => {
                context('and the user has all the permissions', () => {
                    context('and it tries to create new age ranges', () => {
                        it('creates all the age ranges in the organization', async () => {
                            const gqlAgeRanges = await createOrUpdateAgeRanges(
                                testClient,
                                organization.organization_id,
                                [ageRangeInfo(ageRange)],
                                { authorization: getAdminAuthToken() }
                            )

                            const dbAgeRanges = await AgeRange.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbAgeRanges).not.to.be.empty
                            expect(dbAgeRanges.map(ageRangeInfo)).to.deep.eq(
                                gqlAgeRanges.map(ageRangeInfo)
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system age ranges',
                        () => {
                            let newAgeRange: any

                            beforeEach(async () => {
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [ageRangeInfo(ageRange)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newAgeRange = {
                                    ...ageRangeInfo(ageRange),
                                    ...{
                                        id: gqlAgeRanges[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected age ranges in the organization', async () => {
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [newAgeRange],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbAgeRanges = await AgeRange.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbAgeRanges).not.to.be.empty
                                expect(
                                    dbAgeRanges.map(ageRangeInfo)
                                ).to.deep.eq([newAgeRange].map(ageRangeInfo))
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system age ranges',
                        () => {
                            let newAgeRange: any

                            beforeEach(async () => {
                                ageRange.system = true
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [ageRangeInfo(ageRange)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newAgeRange = {
                                    ...ageRangeInfo(ageRange),
                                    ...{
                                        id: gqlAgeRanges[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected age ranges in the organization', async () => {
                                const gqlAgeRanges = await createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [newAgeRange],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbAgeRanges = await AgeRange.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbAgeRanges).not.to.be.empty
                                expect(
                                    dbAgeRanges.map(ageRangeInfo)
                                ).to.deep.eq([newAgeRange].map(ageRangeInfo))
                            })
                        }
                    )
                })
            })
        })
    })

    describe('ageRanges', () => {
        let user: User
        let organization: Organization
        let ageRange: AgeRange

        const ageRangeInfo = (ageRange: AgeRange) => {
            return {
                name: ageRange.name,
                high_value: ageRange.high_value,
                high_value_unit: ageRange.high_value_unit,
                low_value: ageRange.low_value,
                low_value_unit: ageRange.low_value_unit,
                system: ageRange.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            ageRange = createAgeRange(organization)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await ageRange.save()
        })

        context('when not authenticated', () => {
            it('fails to list age ranges in the organization', async () => {
                await expect(
                    listAgeRanges(testClient, organization.organization_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbAgeRanges = await AgeRange.find({
                    where: {
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })
                expect(dbAgeRanges).not.to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view age range permissions',
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

                    it('fails to list age ranges in the organization', async () => {
                        await expect(
                            listAgeRanges(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbAgeRanges = await AgeRange.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        expect(dbAgeRanges).not.to.be.empty
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
                        PermissionName.view_age_range_20112,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the age ranges in the organization', async () => {
                    const gqlAgeRanges = await listAgeRanges(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbAgeRanges = await AgeRange.find({
                        where: [
                            {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                            { system: true },
                        ],
                    })

                    expect(dbAgeRanges).not.to.be.empty
                    expect(dbAgeRanges.map(ageRangeInfo)).to.deep.eq(
                        gqlAgeRanges.map(ageRangeInfo)
                    )
                })
            })
        })
    })

    describe('createOrUpdateGrades', () => {
        let user: User
        let organization: Organization
        let progressFromGrade: Grade
        let progressToGrade: Grade
        let grade: Grade

        let progressFromGradeDetails: any
        let progressToGradeDetails: any

        const gradeInfo = async (grade: Grade) => {
            return {
                name: grade.name,
                progress_from_grade_id: (await grade.progress_from_grade)?.id,
                progress_to_grade_id: (await grade.progress_to_grade)?.id,
                system: grade.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            progressFromGrade = createGrade(organization)
            await progressFromGrade.save()
            progressFromGradeDetails = await gradeInfo(progressFromGrade)
            progressToGrade = createGrade(organization)
            await progressToGrade.save()
            progressToGradeDetails = await gradeInfo(progressToGrade)
            grade = createGrade(
                organization,
                progressFromGrade,
                progressToGrade
            )
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            context('and it tries to create new grades', () => {
                it('fails to create grades in the organization', async () => {
                    const gradeDetails = await gradeInfo(grade)

                    await expect(
                        createOrUpdateGrades(
                            testClient,
                            organization.organization_id,
                            [gradeDetails],
                            { authorization: undefined }
                        )
                    ).to.be.rejected

                    const dbGrades = await Grade.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    const dGradesDetails = await Promise.all(
                        dbGrades.map(gradeInfo)
                    )
                    expect(dGradesDetails).to.deep.eq([
                        progressFromGradeDetails,
                        progressToGradeDetails,
                    ])
                })
            })

            context('and it tries to update existing non system grades', () => {
                let gradeDetails: any
                let newGrade: any

                beforeEach(async () => {
                    gradeDetails = await gradeInfo(grade)
                    const gqlGrades = await createOrUpdateGrades(
                        testClient,
                        organization.organization_id,
                        [gradeDetails],
                        { authorization: getAdminAuthToken() }
                    )

                    newGrade = {
                        ...gradeDetails,
                        ...{ id: gqlGrades[0].id, name: 'New Name' },
                    }
                })

                it('fails to update grades in the organization', async () => {
                    await expect(
                        createOrUpdateGrades(
                            testClient,
                            organization.organization_id,
                            [newGrade],
                            { authorization: undefined }
                        )
                    ).to.be.rejected

                    const dbGrades = await Grade.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    const dGradesDetails = await Promise.all(
                        dbGrades.map(gradeInfo)
                    )
                    expect(dGradesDetails).to.deep.eq([
                        progressFromGradeDetails,
                        progressToGradeDetails,
                        gradeDetails,
                    ])
                })
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have create grades permissions',
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

                    context('and it tries to create new grades', () => {
                        it('fails to create grades in the organization', async () => {
                            const gradeDetails = await gradeInfo(grade)

                            await expect(
                                createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [gradeDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected

                            const dbGrades = await Grade.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })
                            const dGradesDetails = await Promise.all(
                                dbGrades.map(gradeInfo)
                            )
                            expect(dGradesDetails).to.deep.eq([
                                progressFromGradeDetails,
                                progressToGradeDetails,
                            ])
                        })
                    })
                }
            )

            context(
                'and the user does not have edit age range permissions',
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

                    context(
                        'and it tries to update existing non system grades',
                        () => {
                            let gradeDetails: any
                            let newGrade: any

                            beforeEach(async () => {
                                gradeDetails = await gradeInfo(grade)
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [gradeDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newGrade = {
                                    ...gradeDetails,
                                    ...{
                                        id: gqlGrades[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update grades in the organization', async () => {
                                await expect(
                                    createOrUpdateGrades(
                                        testClient,
                                        organization.organization_id,
                                        [newGrade],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbGrades = await Grade.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })
                                const dGradesDetails = await Promise.all(
                                    dbGrades.map(gradeInfo)
                                )
                                expect(dGradesDetails).to.deep.eq([
                                    progressFromGradeDetails,
                                    progressToGradeDetails,
                                    gradeDetails,
                                ])
                            })
                        }
                    )
                }
            )

            context('and is a non admin user', () => {
                let gradeDetails: any

                context('and the user has all the permissions', () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.create_grade_20223,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_grade_20333,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                        gradeDetails = await gradeInfo(grade)
                    })

                    context('and it tries to create new grades', () => {
                        it('creates all the grades in the organization', async () => {
                            const gqlGrades = await createOrUpdateGrades(
                                testClient,
                                organization.organization_id,
                                [gradeDetails],
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbGrades = await Grade.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            const dGradesDetails = await Promise.all(
                                dbGrades.map(gradeInfo)
                            )
                            expect(dGradesDetails).to.deep.eq([
                                progressFromGradeDetails,
                                progressToGradeDetails,
                                gradeDetails,
                            ])
                        })
                    })

                    context(
                        'and it tries to update existing non system grades',
                        () => {
                            let newGrade: any
                            let newGradeDetails: any

                            beforeEach(async () => {
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [gradeDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newGrade = {
                                    ...gradeDetails,
                                    ...{
                                        id: gqlGrades[0].id,
                                        name: 'New Name',
                                    },
                                }

                                newGradeDetails = {
                                    ...gradeDetails,
                                    ...{ name: 'New Name' },
                                }
                            })

                            it('updates the expected grades in the organization', async () => {
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [newGrade],
                                    { authorization: getNonAdminAuthToken() }
                                )

                                const dbGrades = await Grade.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })
                                const dGradesDetails = await Promise.all(
                                    dbGrades.map(gradeInfo)
                                )
                                expect(dGradesDetails).to.deep.eq([
                                    progressFromGradeDetails,
                                    progressToGradeDetails,
                                    newGradeDetails,
                                ])
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system age ranges',
                        () => {
                            let newGrade: any

                            beforeEach(async () => {
                                gradeDetails.system = true
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [gradeDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newGrade = {
                                    ...gradeDetails,
                                    ...{
                                        id: gqlGrades[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update age ranges in the organization', async () => {
                                await expect(
                                    createOrUpdateGrades(
                                        testClient,
                                        organization.organization_id,
                                        [newGrade],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbGrades = await Grade.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })
                                const dGradesDetails = await Promise.all(
                                    dbGrades.map(gradeInfo)
                                )
                                expect(dGradesDetails).to.deep.eq([
                                    progressFromGradeDetails,
                                    progressToGradeDetails,
                                    gradeDetails,
                                ])
                            })
                        }
                    )
                })
            })

            context('and is an admin user', () => {
                let gradeDetails: any

                beforeEach(async () => {
                    gradeDetails = await gradeInfo(grade)
                })

                context('and the user has all the permissions', () => {
                    context('and it tries to create grades', () => {
                        it('creates all the grades in the organization', async () => {
                            const gqlGrades = await createOrUpdateGrades(
                                testClient,
                                organization.organization_id,
                                [gradeDetails],
                                { authorization: getAdminAuthToken() }
                            )

                            const dbGrades = await Grade.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            const dGradesDetails = await Promise.all(
                                dbGrades.map(gradeInfo)
                            )
                            expect(dGradesDetails).to.deep.eq([
                                progressFromGradeDetails,
                                progressToGradeDetails,
                                gradeDetails,
                            ])
                        })
                    })

                    context(
                        'and it tries to update existing non system grades',
                        () => {
                            let newGrade: any
                            let newGradeDetails: any

                            beforeEach(async () => {
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [gradeDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newGrade = {
                                    ...gradeDetails,
                                    ...{
                                        id: gqlGrades[0].id,
                                        name: 'New Name',
                                    },
                                }

                                newGradeDetails = {
                                    ...gradeDetails,
                                    ...{ name: 'New Name' },
                                }
                            })

                            it('updates the expected grades in the organization', async () => {
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [newGrade],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbGrades = await Grade.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })
                                const dGradesDetails = await Promise.all(
                                    dbGrades.map(gradeInfo)
                                )
                                expect(dGradesDetails).to.deep.eq([
                                    progressFromGradeDetails,
                                    progressToGradeDetails,
                                    newGradeDetails,
                                ])
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system age ranges',
                        () => {
                            let newGrade: any
                            let newGradeDetails: any

                            beforeEach(async () => {
                                gradeDetails.system = true
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [gradeDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newGrade = {
                                    ...gradeDetails,
                                    ...{
                                        id: gqlGrades[0].id,
                                        name: 'New Name',
                                    },
                                }

                                newGradeDetails = {
                                    ...gradeDetails,
                                    ...{ name: 'New Name' },
                                }
                            })

                            it('updates the expected grades in the organization', async () => {
                                const gqlGrades = await createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [newGrade],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbGrades = await Grade.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })
                                const dGradesDetails = await Promise.all(
                                    dbGrades.map(gradeInfo)
                                )
                                expect(dGradesDetails).to.deep.eq([
                                    progressFromGradeDetails,
                                    progressToGradeDetails,
                                    newGradeDetails,
                                ])
                            })
                        }
                    )
                })
            })
        })
    })

    describe('grades', () => {
        let user: User
        let organization: Organization
        let progressFromGrade: Grade
        let progressToGrade: Grade
        let grade: Grade

        let gradeDetails: any
        let progressFromGradeDetails: any
        let progressToGradeDetails: any

        const gradeInfo = async (grade: Grade) => {
            return {
                name: grade.name,
                progress_from_grade_id: (await grade.progress_from_grade)?.id,
                progress_to_grade_id: (await grade.progress_to_grade)?.id,
                system: grade.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            progressFromGrade = createGrade(organization)
            await progressFromGrade.save()
            progressFromGradeDetails = await gradeInfo(progressFromGrade)
            progressToGrade = createGrade(organization)
            await progressToGrade.save()
            progressToGradeDetails = await gradeInfo(progressToGrade)
            grade = createGrade(
                organization,
                progressFromGrade,
                progressToGrade
            )
            await grade.save()
            gradeDetails = await gradeInfo(grade)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            it('fails to list grades in the organization', async () => {
                await expect(
                    listGrades(testClient, organization.organization_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbGrades = await Grade.find({
                    where: {
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })
                const dGradesDetails = await Promise.all(
                    dbGrades.map(gradeInfo)
                )
                expect(dGradesDetails).to.deep.eq([
                    progressFromGradeDetails,
                    progressToGradeDetails,
                    gradeDetails,
                ])
            })
        })

        context('when authenticated', () => {
            context('and the user does not have view grade permissions', () => {
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

                it('fails to list grades in the organization', async () => {
                    await expect(
                        listGrades(testClient, organization.organization_id, {
                            authorization: getNonAdminAuthToken(),
                        })
                    ).to.be.rejected

                    const dbGrades = await Grade.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    const dGradesDetails = await Promise.all(
                        dbGrades.map(gradeInfo)
                    )
                    expect(dGradesDetails).to.deep.eq([
                        progressFromGradeDetails,
                        progressToGradeDetails,
                        gradeDetails,
                    ])
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
                        PermissionName.view_grades_20113,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the grades in the organization', async () => {
                    const gqlGrades = await listGrades(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const gqlGradesDetails = await Promise.all(
                        gqlGrades.map(gradeInfo)
                    )
                    expect(gqlGradesDetails).to.deep.eq([
                        progressFromGradeDetails,
                        progressToGradeDetails,
                        gradeDetails,
                    ])
                })
                context('and the user is inactive', () => {
                    beforeEach(async () => {
                        const dbUser = await User.findOneOrFail(user.user_id)
                        if (dbUser) {
                            dbUser.status = Status.INACTIVE
                            await connection.manager.save(dbUser)
                        }
                    })
                    it('fails to list grades in the organization', async () => {
                        await expect(
                            listGrades(
                                testClient,
                                organization.organization_id,
                                {
                                    authorization: getNonAdminAuthToken(),
                                }
                            )
                        ).to.be.rejected

                        const dbGrades = await Grade.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        const dGradesDetails = await Promise.all(
                            dbGrades.map(gradeInfo)
                        )
                        expect(dGradesDetails).to.deep.eq([
                            progressFromGradeDetails,
                            progressToGradeDetails,
                            gradeDetails,
                        ])
                    })
                })
            })
        })
    })

    describe('createOrUpdateSubcategories', () => {
        let user: User
        let organization: Organization
        let subcategory: Subcategory
        let newSubcategory: any

        const subcategoryInfo = (subcategory: Subcategory) => {
            return {
                name: subcategory.name,
                system: subcategory.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            subcategory = createSubcategory(organization)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            context('and it tries to create new subcategories', () => {
                it('fails to create subcstegories in the organization', async () => {
                    await expect(
                        createOrUpdateSubcategories(
                            testClient,
                            organization.organization_id,
                            [subcategoryInfo(subcategory)],
                            { authorization: undefined }
                        )
                    ).to.be.rejected

                    const dbSubcategories = await Subcategory.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    expect(dbSubcategories).to.be.empty
                })
            })

            context(
                'and it tries to update existing non system subcategories',
                () => {
                    beforeEach(async () => {
                        const gqlSubcategories = await createOrUpdateSubcategories(
                            testClient,
                            organization.organization_id,
                            [subcategoryInfo(subcategory)],
                            { authorization: getAdminAuthToken() }
                        )

                        newSubcategory = {
                            ...subcategoryInfo(subcategory),
                            ...{ id: gqlSubcategories[0].id, name: 'New Name' },
                        }
                    })

                    it('fails to update subcategories in the organization', async () => {
                        await expect(
                            createOrUpdateSubcategories(
                                testClient,
                                organization.organization_id,
                                [subcategoryInfo(newSubcategory)],
                                { authorization: undefined }
                            )
                        ).to.be.rejected

                        const dbSubcategories = await Subcategory.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })

                        expect(dbSubcategories).not.to.be.empty
                        expect(dbSubcategories.map(subcategoryInfo)).to.deep.eq(
                            [subcategory].map(subcategoryInfo)
                        )
                    })
                }
            )
        })

        context('when authenticated', () => {
            context(
                'and the user does not have create subject permissions',
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

                    context('and it tries to create new subcategories', () => {
                        it('fails to create subcstegories in the organization', async () => {
                            await expect(
                                createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [subcategoryInfo(subcategory)],
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected

                            const dbSubcategories = await Subcategory.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })
                            expect(dbSubcategories).to.be.empty
                        })
                    })
                }
            )

            context(
                'and the user does not have edit subject permissions',
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

                    context(
                        'and it tries to update existing non system subcategories',
                        () => {
                            beforeEach(async () => {
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [subcategoryInfo(subcategory)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubcategory = {
                                    ...subcategoryInfo(subcategory),
                                    ...{
                                        id: gqlSubcategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update subcategories in the organization', async () => {
                                await expect(
                                    createOrUpdateSubcategories(
                                        testClient,
                                        organization.organization_id,
                                        [newSubcategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbSubcategories = await Subcategory.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubcategories).not.to.be.empty
                                expect(
                                    dbSubcategories.map(subcategoryInfo)
                                ).to.deep.eq([subcategory].map(subcategoryInfo))
                            })
                        }
                    )
                }
            )

            context('and is a non admin user', () => {
                context('and the user has all the permissions', () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.create_subjects_20227,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_subjects_20337,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    context('and it tries to create new subcategories', () => {
                        it('creates all the subcategories in the organization', async () => {
                            const gqlSubcategories = await createOrUpdateSubcategories(
                                testClient,
                                organization.organization_id,
                                [subcategoryInfo(subcategory)],
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbSubcategories = await Subcategory.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbSubcategories).not.to.be.empty
                            expect(
                                dbSubcategories.map(subcategoryInfo)
                            ).to.deep.eq(gqlSubcategories.map(subcategoryInfo))
                        })
                    })

                    context(
                        'and it tries to update existing non system subcategories',
                        () => {
                            beforeEach(async () => {
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [subcategoryInfo(subcategory)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubcategory = {
                                    ...subcategoryInfo(subcategory),
                                    ...{
                                        id: gqlSubcategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected subcategories in the organization', async () => {
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [newSubcategory],
                                    {
                                        authorization: getNonAdminAuthToken(),
                                    }
                                )

                                const dbSubcategories = await Subcategory.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubcategories).not.to.be.empty
                                expect(
                                    dbSubcategories.map(subcategoryInfo)
                                ).to.deep.eq(
                                    [newSubcategory].map(subcategoryInfo)
                                )
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system subcategories',
                        () => {
                            beforeEach(async () => {
                                subcategory.system = true
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [subcategoryInfo(subcategory)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubcategory = {
                                    ...subcategoryInfo(subcategory),
                                    ...{
                                        id: gqlSubcategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update subcategories in the organization', async () => {
                                await expect(
                                    createOrUpdateSubcategories(
                                        testClient,
                                        organization.organization_id,
                                        [newSubcategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbSubcategories = await Subcategory.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubcategories).not.to.be.empty
                                expect(
                                    dbSubcategories.map(subcategoryInfo)
                                ).to.deep.eq([subcategory].map(subcategoryInfo))
                            })
                        }
                    )
                })
            })

            context('and is an admin user', () => {
                context('and the user has all the permissions', () => {
                    context('and it tries to create new subcategories', () => {
                        it('creates all the subcategories in the organization', async () => {
                            const gqlSubcategories = await createOrUpdateSubcategories(
                                testClient,
                                organization.organization_id,
                                [subcategoryInfo(subcategory)],
                                { authorization: getAdminAuthToken() }
                            )

                            const dbSubcategories = await Subcategory.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbSubcategories).not.to.be.empty
                            expect(
                                dbSubcategories.map(subcategoryInfo)
                            ).to.deep.eq(gqlSubcategories.map(subcategoryInfo))
                        })
                    })

                    context(
                        'and it tries to update existing non system subcategories',
                        () => {
                            beforeEach(async () => {
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [subcategoryInfo(subcategory)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubcategory = {
                                    ...subcategoryInfo(subcategory),
                                    ...{
                                        id: gqlSubcategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected subcategories in the organization', async () => {
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [newSubcategory],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbSubcategories = await Subcategory.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubcategories).not.to.be.empty
                                expect(
                                    dbSubcategories.map(subcategoryInfo)
                                ).to.deep.eq(
                                    [newSubcategory].map(subcategoryInfo)
                                )
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system subcategories',
                        () => {
                            beforeEach(async () => {
                                subcategory.system = true
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [subcategoryInfo(subcategory)],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubcategory = {
                                    ...subcategoryInfo(subcategory),
                                    ...{
                                        id: gqlSubcategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected subcategories in the organization', async () => {
                                const gqlSubcategories = await createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [newSubcategory],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbSubcategories = await Subcategory.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubcategories).not.to.be.empty
                                expect(
                                    dbSubcategories.map(subcategoryInfo)
                                ).to.deep.eq(
                                    [newSubcategory].map(subcategoryInfo)
                                )
                            })
                        }
                    )
                })
            })
        })
    })

    describe('subcategories', () => {
        let user: User
        let organization: Organization
        let subcategory: Subcategory

        const subcategoryInfo = (subcategory: Subcategory) => {
            return {
                id: subcategory.id,
                name: subcategory.name,
                system: subcategory.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            subcategory = createSubcategory(organization)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await subcategory.save()
        })

        context('when not authenticated', () => {
            it('fails to list subcategories in the organization', async () => {
                await expect(
                    listSubcategories(
                        testClient,
                        organization.organization_id,
                        { authorization: undefined }
                    )
                ).to.be.rejected

                const dbSubcategories = await Subcategory.find({
                    where: {
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })
                expect(dbSubcategories).not.to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view subject permissions',
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

                    it('fails to list subcategories in the organization', async () => {
                        await expect(
                            listSubcategories(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbSubcategories = await Subcategory.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        expect(dbSubcategories).not.to.be.empty
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
                        PermissionName.view_subjects_20115,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the subcategories in the organization', async () => {
                    const gqlSubcategories = await listSubcategories(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbSubcategories = await Subcategory.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })

                    expect(dbSubcategories).not.to.be.empty
                    expect(dbSubcategories.map(subcategoryInfo)).to.deep.eq(
                        gqlSubcategories.map(subcategoryInfo)
                    )
                })
                context('and the user is inactive', () => {
                    beforeEach(async () => {
                        const dbUser = await User.findOneOrFail(user.user_id)
                        if (dbUser) {
                            dbUser.status = Status.INACTIVE
                            await connection.manager.save(dbUser)
                        }
                    })
                    it('fails to list subcategories in the organization', async () => {
                        await expect(
                            listSubcategories(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbSubcategories = await Subcategory.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        expect(dbSubcategories).not.to.be.empty
                    })
                })
            })
        })
    })

    describe('createOrUpdateCategories', () => {
        let user: User
        let organization: Organization
        let category: Category
        let subcategory: Subcategory
        let newCategory: any

        let categoryDetails: any

        const subcategoryInfo = (subcategory: Subcategory) => {
            return subcategory.id
        }

        const categoryInfo = async (category: any) => {
            return {
                name: category.name,
                subcategories: ((await category.subcategories) || []).map(
                    subcategoryInfo
                ),
                system: category.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            subcategory = createSubcategory(organization)
            await subcategory.save()
            category = createCategory(organization, [subcategory])
            categoryDetails = await categoryInfo(category)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            context('and it tries to create new categories', () => {
                it('fails to create subcstegories in the organization', async () => {
                    await expect(
                        createOrUpdateCategories(
                            testClient,
                            organization.organization_id,
                            [categoryDetails],
                            { authorization: undefined }
                        )
                    ).to.be.rejected

                    const dbCategories = await Category.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    expect(dbCategories).to.be.empty
                })
            })

            context(
                'and it tries to update existing non-system categories',
                () => {
                    beforeEach(async () => {
                        const gqlCategories = await createOrUpdateCategories(
                            testClient,
                            organization.organization_id,
                            [categoryDetails],
                            { authorization: getAdminAuthToken() }
                        )

                        newCategory = {
                            ...categoryDetails,
                            ...{ id: gqlCategories[0].id, name: 'New Name' },
                        }
                    })

                    it('fails to update categories in the organization', async () => {
                        await expect(
                            createOrUpdateCategories(
                                testClient,
                                organization.organization_id,
                                [categoryInfo(newCategory)],
                                { authorization: undefined }
                            )
                        ).to.be.rejected

                        const dbCategories = await Category.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })

                        expect(dbCategories).not.to.be.empty
                        const dbCategoryDetails = await Promise.all(
                            dbCategories.map(categoryInfo)
                        )
                        expect(dbCategoryDetails).to.deep.eq([categoryDetails])
                    })
                }
            )
        })

        context('when authenticated', () => {
            context(
                'and the user does not have create subject permissions',
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

                    context('and it tries to create new categories', () => {
                        it('fails to create subcstegories in the organization', async () => {
                            await expect(
                                createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [categoryDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected

                            const dbCategories = await Category.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })
                            expect(dbCategories).to.be.empty
                        })
                    })
                }
            )

            context(
                'and the user does not have edit subject permissions',
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

                    context(
                        'and it tries to update existing non-system categories',
                        () => {
                            beforeEach(async () => {
                                const gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [categoryDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newCategory = {
                                    ...categoryDetails,
                                    ...{
                                        id: gqlCategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update categories in the organization', async () => {
                                await expect(
                                    createOrUpdateCategories(
                                        testClient,
                                        organization.organization_id,
                                        [newCategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbCategories = await Category.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbCategories).not.to.be.empty
                                const dbCategoryDetails = await Promise.all(
                                    dbCategories.map(categoryInfo)
                                )
                                expect(dbCategoryDetails).to.deep.eq([
                                    categoryDetails,
                                ])
                            })
                        }
                    )
                }
            )

            context('and is a non admin user', () => {
                context('and the user has all the permissions', () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.create_subjects_20227,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_subjects_20337,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    context('and it tries to create new categories', () => {
                        it('creates all the categories in the organization', async () => {
                            const gqlCategories = await createOrUpdateCategories(
                                testClient,
                                organization.organization_id,
                                [categoryDetails],
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbCategories = await Category.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbCategories).not.to.be.empty
                            const dbCategoryDetails = await Promise.all(
                                dbCategories.map(categoryInfo)
                            )
                            const gqlCateryDetails = await Promise.all(
                                gqlCategories.map(categoryInfo)
                            )
                            expect(dbCategoryDetails).to.deep.eq(
                                gqlCateryDetails
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system categories',
                        () => {
                            beforeEach(async () => {
                                const gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [categoryDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newCategory = {
                                    ...categoryDetails,
                                    ...{
                                        id: gqlCategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected categories in the organization', async () => {
                                let gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [newCategory],
                                    {
                                        authorization: getNonAdminAuthToken(),
                                    }
                                )

                                let dbCategories = await Category.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbCategories).not.to.be.empty
                                let dbCategoryDetails = await Promise.all(
                                    dbCategories.map(categoryInfo)
                                )
                                const newCategoryDetails = {
                                    ...categoryDetails,
                                    name: newCategory.name,
                                }
                                expect(dbCategoryDetails).to.deep.eq([
                                    newCategoryDetails,
                                ])

                                newCategory.subcategories = []
                                gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [newCategory],
                                    { authorization: getNonAdminAuthToken() }
                                )

                                dbCategories = await Category.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbCategories).not.to.be.empty
                                dbCategoryDetails = await Promise.all(
                                    dbCategories.map(categoryInfo)
                                )
                                const gqlCateryDetails = await Promise.all(
                                    gqlCategories.map(categoryInfo)
                                )
                                expect(dbCategoryDetails).to.deep.eq(
                                    gqlCateryDetails
                                )
                            })
                        }
                    )
                    // skipped temporarily because authorization check is not currently in place/was removed
                    // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                    context.skip(
                        'and it tries to update existing system categories',
                        () => {
                            beforeEach(async () => {
                                category.system = true
                                const gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [categoryDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newCategory = {
                                    ...categoryDetails,
                                    ...{
                                        id: gqlCategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update categories in the organization', async () => {
                                await expect(
                                    createOrUpdateCategories(
                                        testClient,
                                        organization.organization_id,
                                        [newCategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbCategories = await Category.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbCategories).not.to.be.empty
                                const dbCategoryDetails = await Promise.all(
                                    dbCategories.map(categoryInfo)
                                )
                                expect(dbCategoryDetails).to.deep.eq([
                                    categoryDetails,
                                ])
                            })
                        }
                    )
                })
            })

            context('and is an admin user', () => {
                context('and the user has all the permissions', () => {
                    context('and it tries to create new categories', () => {
                        it('creates all the categories in the organization', async () => {
                            const gqlCategories = await createOrUpdateCategories(
                                testClient,
                                organization.organization_id,
                                [categoryDetails],
                                { authorization: getAdminAuthToken() }
                            )

                            const dbCategories = await Category.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbCategories).not.to.be.empty
                            const dbCategoryDetails = await Promise.all(
                                dbCategories.map(categoryInfo)
                            )
                            const gqlCateryDetails = await Promise.all(
                                gqlCategories.map(categoryInfo)
                            )
                            expect(dbCategoryDetails).to.deep.eq(
                                gqlCateryDetails
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system categories',
                        () => {
                            beforeEach(async () => {
                                const gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [categoryDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newCategory = {
                                    ...categoryDetails,
                                    ...{
                                        id: gqlCategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected categories in the organization', async () => {
                                const gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [newCategory],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbCategories = await Category.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbCategories).not.to.be.empty
                                const dbCategoryDetails = await Promise.all(
                                    dbCategories.map(categoryInfo)
                                )
                                const newCategoryDetails = {
                                    ...categoryDetails,
                                    name: newCategory.name,
                                }
                                expect(dbCategoryDetails).to.deep.eq([
                                    newCategoryDetails,
                                ])
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system categories',
                        () => {
                            beforeEach(async () => {
                                category.system = true
                                const gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [categoryDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newCategory = {
                                    ...categoryDetails,
                                    ...{
                                        id: gqlCategories[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected categories in the organization', async () => {
                                const gqlCategories = await createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [newCategory],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbCategories = await Category.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbCategories).not.to.be.empty
                                const dbCategoryDetails = await Promise.all(
                                    dbCategories.map(categoryInfo)
                                )
                                const newCategoryDetails = {
                                    ...categoryDetails,
                                    name: newCategory.name,
                                }
                                expect(dbCategoryDetails).to.deep.eq([
                                    newCategoryDetails,
                                ])
                            })
                        }
                    )
                })
            })
        })
    })

    describe('categories', () => {
        let user: User
        let organization: Organization
        let subcategory: Subcategory
        let category: Category

        let categoryDetails: any

        const subcategoryInfo = (subcategory: Subcategory) => {
            return subcategory.id
        }

        const categoryInfo = async (category: Category) => {
            return {
                name: category.name,
                subcategories: ((await category.subcategories) || []).map(
                    subcategoryInfo
                ),
                system: category.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            subcategory = createSubcategory(organization)
            await subcategory.save()
            category = createCategory(organization)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await category.save()
        })

        context('when not authenticated', () => {
            it('fails to list categories in the organization', async () => {
                await expect(
                    listCategories(testClient, organization.organization_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbCategories = await Category.find({
                    where: {
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })
                expect(dbCategories).not.to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view subject permissions',
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

                    it('fails to list categories in the organization', async () => {
                        await expect(
                            listCategories(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbCategories = await Category.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        expect(dbCategories).not.to.be.empty
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
                        PermissionName.view_subjects_20115,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the categories in the organization', async () => {
                    const gqlCategories = await listCategories(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbCategories = await Category.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })

                    expect(dbCategories).not.to.be.empty
                    const dbCategoryDetails = await Promise.all(
                        dbCategories.map(categoryInfo)
                    )
                    const gqlCateryDetails = await Promise.all(
                        gqlCategories.map(categoryInfo)
                    )
                    expect(dbCategoryDetails).to.deep.eq(gqlCateryDetails)
                })
            })
        })
    })

    describe('createOrUpdateSubjects', () => {
        let user: User
        let organization: Organization
        let subject: Subject
        let category: Category
        let newSubject: any

        let subjectDetails: any

        const categoryInfo = (category: any) => {
            return category.id
        }

        const subjectInfo = async (subject: Subject) => {
            return {
                name: subject.name,
                categories: ((await subject.categories) || []).map(
                    categoryInfo
                ),
                system: subject.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            category = createCategory(organization)
            await category.save()
            subject = createSubject(organization, [category])
            subjectDetails = await subjectInfo(subject)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            context('and it tries to create new categories', () => {
                it('fails to create subcstegories in the organization', async () => {
                    await expect(
                        createOrUpdateSubjects(
                            testClient,
                            organization.organization_id,
                            [subjectDetails],
                            { authorization: undefined }
                        )
                    ).to.be.rejected

                    const dbSubjects = await Subject.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    expect(dbSubjects).to.be.empty
                })
            })

            context(
                'and it tries to update existing non-system categories',
                () => {
                    beforeEach(async () => {
                        const gqlSubjects = await createOrUpdateSubjects(
                            testClient,
                            organization.organization_id,
                            [subjectDetails],
                            { authorization: getAdminAuthToken() }
                        )

                        newSubject = {
                            ...subjectDetails,
                            ...{ id: gqlSubjects[0].id, name: 'New Name' },
                        }
                    })

                    it('fails to update categories in the organization', async () => {
                        await expect(
                            createOrUpdateSubjects(
                                testClient,
                                organization.organization_id,
                                [subjectInfo(newSubject)],
                                { authorization: undefined }
                            )
                        ).to.be.rejected

                        const dbSubjects = await Subject.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })

                        expect(dbSubjects).not.to.be.empty
                        const dbSubjectDetails = await Promise.all(
                            dbSubjects.map(subjectInfo)
                        )
                        expect(dbSubjectDetails).to.deep.eq([subjectDetails])
                    })
                }
            )
        })

        context('when authenticated', () => {
            context(
                'and the user does not have create subject permissions',
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

                    context('and it tries to create new categories', () => {
                        it('fails to create subcstegories in the organization', async () => {
                            await expect(
                                createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [subjectDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected

                            const dbSubjects = await Subject.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })
                            expect(dbSubjects).to.be.empty
                        })
                    })
                }
            )

            context(
                'and the user does not have edit subject permissions',
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

                    context(
                        'and it tries to update existing non-system categories',
                        () => {
                            beforeEach(async () => {
                                const gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [subjectDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubject = {
                                    ...subjectDetails,
                                    ...{
                                        id: gqlSubjects[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update categories in the organization', async () => {
                                await expect(
                                    createOrUpdateSubjects(
                                        testClient,
                                        organization.organization_id,
                                        [newSubject],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbSubjects = await Subject.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubjects).not.to.be.empty
                                const dbSubjectDetails = await Promise.all(
                                    dbSubjects.map(subjectInfo)
                                )
                                expect(dbSubjectDetails).to.deep.eq([
                                    subjectDetails,
                                ])
                            })
                        }
                    )
                }
            )

            context('and is a non admin user', () => {
                context('and the user has all the permissions', () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.create_subjects_20227,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.view_subjects_20115,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_subjects_20337,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    context('and it tries to create new categories', () => {
                        it('creates all the categories in the organization', async () => {
                            const gqlSubjects = await createOrUpdateSubjects(
                                testClient,
                                organization.organization_id,
                                [subjectDetails],
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbSubjects = await Subject.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbSubjects).not.to.be.empty
                            const dbSubjectDetails = await Promise.all(
                                dbSubjects.map(subjectInfo)
                            )
                            const gqlCateryDetails = await Promise.all(
                                gqlSubjects.map(subjectInfo)
                            )
                            expect(dbSubjectDetails).to.deep.eq(
                                gqlCateryDetails
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system categories',
                        () => {
                            beforeEach(async () => {
                                const gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [subjectDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubject = {
                                    ...subjectDetails,
                                    ...{
                                        id: gqlSubjects[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected categories in the organization', async () => {
                                let gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [newSubject],
                                    { authorization: getNonAdminAuthToken() }
                                )

                                let dbSubjects = await Subject.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubjects).not.to.be.empty
                                let dbSubjectDetails = await Promise.all(
                                    dbSubjects.map(subjectInfo)
                                )
                                const newSubjectDetails = {
                                    ...subjectDetails,
                                    name: newSubject.name,
                                }
                                expect(dbSubjectDetails).to.deep.eq([
                                    newSubjectDetails,
                                ])

                                newSubject.categories = []
                                gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [newSubject],
                                    { authorization: getNonAdminAuthToken() }
                                )

                                dbSubjects = await Subject.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubjects).not.to.be.empty
                                dbSubjectDetails = await Promise.all(
                                    dbSubjects.map(subjectInfo)
                                )
                                const gqlSubjectDetails = await Promise.all(
                                    gqlSubjects.map(subjectInfo)
                                )
                                expect(dbSubjectDetails).to.deep.eq(
                                    gqlSubjectDetails
                                )
                            })
                        }
                    )
                    // skipped temporarily because authorization check is not currently in place/was removed
                    // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                    context.skip(
                        'and it tries to update existing system categories',
                        () => {
                            beforeEach(async () => {
                                subject.system = true
                                const gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [subjectDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubject = {
                                    ...subjectDetails,
                                    ...{
                                        id: gqlSubjects[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update categories in the organization', async () => {
                                await expect(
                                    createOrUpdateSubjects(
                                        testClient,
                                        organization.organization_id,
                                        [newSubject],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbSubjects = await Subject.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubjects).not.to.be.empty
                                const dbSubjectDetails = await Promise.all(
                                    dbSubjects.map(subjectInfo)
                                )
                                expect(dbSubjectDetails).to.deep.eq([
                                    subjectDetails,
                                ])
                            })
                        }
                    )
                })
            })

            context('and is an admin user', () => {
                context('and the user has all the permissions', () => {
                    context('and it tries to create new categories', () => {
                        it('creates all the categories in the organization', async () => {
                            const gqlSubjects = await createOrUpdateSubjects(
                                testClient,
                                organization.organization_id,
                                [subjectDetails],
                                { authorization: getAdminAuthToken() }
                            )

                            const dbSubjects = await Subject.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbSubjects).not.to.be.empty
                            const dbSubjectDetails = await Promise.all(
                                dbSubjects.map(subjectInfo)
                            )
                            const gqlCateryDetails = await Promise.all(
                                gqlSubjects.map(subjectInfo)
                            )
                            expect(dbSubjectDetails).to.deep.eq(
                                gqlCateryDetails
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system categories',
                        () => {
                            beforeEach(async () => {
                                const gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [subjectDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubject = {
                                    ...subjectDetails,
                                    ...{
                                        id: gqlSubjects[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected categories in the organization', async () => {
                                const gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [newSubject],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbSubjects = await Subject.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubjects).not.to.be.empty
                                const dbSubjectDetails = await Promise.all(
                                    dbSubjects.map(subjectInfo)
                                )
                                const newSubjectDetails = {
                                    ...subjectDetails,
                                    name: newSubject.name,
                                }
                                expect(dbSubjectDetails).to.deep.eq([
                                    newSubjectDetails,
                                ])
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system categories',
                        () => {
                            beforeEach(async () => {
                                subject.system = true
                                const gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [subjectDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newSubject = {
                                    ...subjectDetails,
                                    ...{
                                        id: gqlSubjects[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected categories in the organization', async () => {
                                const gqlSubjects = await createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [newSubject],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbSubjects = await Subject.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbSubjects).not.to.be.empty
                                const dbSubjectDetails = await Promise.all(
                                    dbSubjects.map(subjectInfo)
                                )
                                const newSubjectDetails = {
                                    ...subjectDetails,
                                    name: newSubject.name,
                                }
                                expect(dbSubjectDetails).to.deep.eq([
                                    newSubjectDetails,
                                ])
                            })
                        }
                    )
                })
            })
        })
    })

    describe('subjects', () => {
        let user: User
        let organization: Organization
        let category: Category
        let subject: Subject

        let subjectDetails: any

        const categoryInfo = (category: any) => {
            return category.id
        }

        const subjectInfo = async (subject: Subject) => {
            return {
                name: subject.name,
                categories: ((await subject.categories) || []).map(
                    categoryInfo
                ),
                system: subject.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            category = createCategory(organization)
            await category.save()
            subject = createSubject(organization, [category])
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
            await subject.save()
        })

        context('when not authenticated', () => {
            it('fails to list subjects in the organization', async () => {
                await expect(
                    listSubjects(testClient, organization.organization_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbSubjects = await Subject.find({
                    where: {
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })
                expect(dbSubjects).not.to.be.empty
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view subject permissions',
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

                    it('fails to list subjects in the organization', async () => {
                        await expect(
                            listSubjects(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbSubjects = await Subject.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        expect(dbSubjects).not.to.be.empty
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
                        PermissionName.view_subjects_20115,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the subjects in the organization', async () => {
                    const gqlSubjects = await listSubjects(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const dbSubjects = await Subject.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })

                    expect(dbSubjects).not.to.be.empty
                    const dbSubjectDetails = await Promise.all(
                        dbSubjects.map(subjectInfo)
                    )
                    const gqlSubjectDetails = await Promise.all(
                        gqlSubjects.map(subjectInfo)
                    )
                    expect(dbSubjectDetails).to.deep.eq(gqlSubjectDetails)
                })
            })
        })
    })

    describe('createOrUpdatePrograms', () => {
        let user: User
        let organization: Organization
        let program: Program
        let ageRange: AgeRange
        let grade: Grade
        let subject: Subject
        let newProgram: any

        let programDetails: any

        const entityInfo = (entity: any) => {
            return entity.id
        }

        const programInfo = async (program: any) => {
            return {
                name: program.name,
                age_ranges: ((await program.age_ranges) || []).map(entityInfo),
                grades: ((await program.grades) || []).map(entityInfo),
                subjects: ((await program.subjects) || []).map(entityInfo),
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
            ageRange = createAgeRange(organization)
            await ageRange.save()
            grade = createGrade(organization)
            await grade.save()
            subject = createSubject(organization)
            await subject.save()
            program = createProgram(
                organization,
                [ageRange],
                [grade],
                [subject]
            )
            programDetails = await programInfo(program)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            context('and it tries to create new programs', () => {
                it('fails to create programs in the organization', async () => {
                    await expect(
                        createOrUpdatePrograms(
                            testClient,
                            organization.organization_id,
                            [programDetails],
                            { authorization: undefined }
                        )
                    ).to.be.rejected

                    const dbPrograms = await Program.find({
                        where: {
                            organization: {
                                organization_id: organization.organization_id,
                            },
                        },
                    })
                    expect(dbPrograms).to.be.empty
                })
            })

            context(
                'and it tries to update existing non system programs',
                () => {
                    beforeEach(async () => {
                        const gqlPrograms = await createOrUpdatePrograms(
                            testClient,
                            organization.organization_id,
                            [programDetails],
                            { authorization: getAdminAuthToken() }
                        )

                        newProgram = {
                            ...programDetails,
                            ...{ id: gqlPrograms[0].id, name: 'New Name' },
                        }
                    })

                    it('fails to update programs in the organization', async () => {
                        await expect(
                            createOrUpdatePrograms(
                                testClient,
                                organization.organization_id,
                                [programInfo(newProgram)],
                                { authorization: undefined }
                            )
                        ).to.be.rejected

                        const dbPrograms = await Program.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })

                        expect(dbPrograms).not.to.be.empty
                        const dbProgramDetails = await Promise.all(
                            dbPrograms.map(programInfo)
                        )
                        expect(dbProgramDetails).to.deep.eq([programDetails])
                    })
                }
            )
        })

        context('when authenticated', () => {
            context(
                'and the user does not have create program permissions',
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

                    context('and it tries to create new programs', () => {
                        it('fails to create programs in the organization', async () => {
                            await expect(
                                createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [programDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )
                            ).to.be.rejected

                            const dbPrograms = await Program.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })
                            expect(dbPrograms).to.be.empty
                        })
                    })
                }
            )

            context(
                'and the user does not have edit program permissions',
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

                    context(
                        'and it tries to update existing non system programs',
                        () => {
                            beforeEach(async () => {
                                const gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [programDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newProgram = {
                                    ...programDetails,
                                    ...{
                                        id: gqlPrograms[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('fails to update programs in the organization', async () => {
                                await expect(
                                    createOrUpdatePrograms(
                                        testClient,
                                        organization.organization_id,
                                        [newProgram],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbPrograms = await Program.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbPrograms).not.to.be.empty
                                const dbProgramDetails = await Promise.all(
                                    dbPrograms.map(programInfo)
                                )
                                expect(dbProgramDetails).to.deep.eq([
                                    programDetails,
                                ])
                            })
                        }
                    )
                }
            )

            context('and is a non admin user', () => {
                context('and the user has all the permissions', () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.create_program_20221,
                            { authorization: getAdminAuthToken() }
                        )
                        await grantPermission(
                            testClient,
                            role.role_id,
                            PermissionName.edit_program_20331,
                            { authorization: getAdminAuthToken() }
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id
                        )
                    })

                    context('and it tries to create new programs', () => {
                        it('creates all the programs in the organization', async () => {
                            const gqlPrograms = await createOrUpdatePrograms(
                                testClient,
                                organization.organization_id,
                                [programDetails],
                                { authorization: getNonAdminAuthToken() }
                            )

                            const dbPrograms = await Program.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbPrograms).not.to.be.empty
                            const dbProgramDetails = await Promise.all(
                                dbPrograms.map(programInfo)
                            )
                            const gqlCateryDetails = await Promise.all(
                                gqlPrograms.map(programInfo)
                            )
                            expect(dbProgramDetails).to.deep.eq(
                                gqlCateryDetails
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system programs',
                        () => {
                            beforeEach(async () => {
                                const gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [programDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newProgram = {
                                    ...programDetails,
                                    ...{
                                        id: gqlPrograms[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected programs in the organization', async () => {
                                let gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [newProgram],
                                    { authorization: getNonAdminAuthToken() }
                                )

                                let dbPrograms = await Program.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbPrograms).not.to.be.empty
                                let dbProgramDetails = await Promise.all(
                                    dbPrograms.map(programInfo)
                                )
                                const newProgramDetails = {
                                    ...programDetails,
                                    name: newProgram.name,
                                }
                                expect(dbProgramDetails).to.deep.eq([
                                    newProgramDetails,
                                ])

                                newProgram.age_ranges = []
                                newProgram.grades = []
                                newProgram.subjects = []
                                gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [newProgram],
                                    { authorization: getNonAdminAuthToken() }
                                )

                                dbPrograms = await Program.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbPrograms).not.to.be.empty
                                dbProgramDetails = await Promise.all(
                                    dbPrograms.map(programInfo)
                                )
                                const gqlCateryDetails = await Promise.all(
                                    gqlPrograms.map(programInfo)
                                )
                                expect(dbProgramDetails).to.deep.eq(
                                    gqlCateryDetails
                                )
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system programs',
                        () => {
                            beforeEach(async () => {
                                program.system = true
                                const gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [programDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newProgram = {
                                    ...programDetails,
                                    ...{
                                        id: gqlPrograms[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })
                            // skipped temporarily because authorization check is not currently in place/was removed
                            // Should be fixed here: https://bitbucket.org/calmisland/kidsloop-user-service/branch/UD-1126-db-implementation
                            it.skip('fails to update programs in the organization', async () => {
                                await expect(
                                    createOrUpdatePrograms(
                                        testClient,
                                        organization.organization_id,
                                        [newProgram],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )
                                ).to.be.rejected

                                const dbPrograms = await Program.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbPrograms).not.to.be.empty
                                const dbProgramDetails = await Promise.all(
                                    dbPrograms.map(programInfo)
                                )
                                expect(dbProgramDetails).to.deep.eq([
                                    programDetails,
                                ])
                            })
                        }
                    )
                })
            })

            context('and is an admin user', () => {
                context('and the user has all the permissions', () => {
                    context('and it tries to create new programs', () => {
                        it('creates all the programs in the organization', async () => {
                            const gqlPrograms = await createOrUpdatePrograms(
                                testClient,
                                organization.organization_id,
                                [programDetails],
                                { authorization: getAdminAuthToken() }
                            )

                            const dbPrograms = await Program.find({
                                where: {
                                    organization: {
                                        organization_id:
                                            organization.organization_id,
                                    },
                                },
                            })

                            expect(dbPrograms).not.to.be.empty
                            const dbProgramDetails = await Promise.all(
                                dbPrograms.map(programInfo)
                            )
                            const gqlCateryDetails = await Promise.all(
                                gqlPrograms.map(programInfo)
                            )
                            expect(dbProgramDetails).to.deep.eq(
                                gqlCateryDetails
                            )
                        })
                    })

                    context(
                        'and it tries to update existing non system programs',
                        () => {
                            beforeEach(async () => {
                                const gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [programDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newProgram = {
                                    ...programDetails,
                                    ...{
                                        id: gqlPrograms[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected programs in the organization', async () => {
                                const gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [newProgram],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbPrograms = await Program.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbPrograms).not.to.be.empty
                                const dbProgramDetails = await Promise.all(
                                    dbPrograms.map(programInfo)
                                )
                                const newProgramDetails = {
                                    ...programDetails,
                                    name: newProgram.name,
                                }
                                expect(dbProgramDetails).to.deep.eq([
                                    newProgramDetails,
                                ])
                            })
                        }
                    )

                    context(
                        'and it tries to update existing system programs',
                        () => {
                            beforeEach(async () => {
                                program.system = true
                                const gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [programDetails],
                                    { authorization: getAdminAuthToken() }
                                )

                                newProgram = {
                                    ...programDetails,
                                    ...{
                                        id: gqlPrograms[0].id,
                                        name: 'New Name',
                                    },
                                }
                            })

                            it('updates the expected programs in the organization', async () => {
                                const gqlPrograms = await createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [newProgram],
                                    { authorization: getAdminAuthToken() }
                                )

                                const dbPrograms = await Program.find({
                                    where: {
                                        organization: {
                                            organization_id:
                                                organization.organization_id,
                                        },
                                    },
                                })

                                expect(dbPrograms).not.to.be.empty
                                const dbProgramDetails = await Promise.all(
                                    dbPrograms.map(programInfo)
                                )
                                const newProgramDetails = {
                                    ...programDetails,
                                    name: newProgram.name,
                                }
                                expect(dbProgramDetails).to.deep.eq([
                                    newProgramDetails,
                                ])
                            })
                        }
                    )
                })
            })
        })
    })

    describe('programs', () => {
        let user: User
        let organization: Organization

        let program: Program

        let programDetails: any

        const programInfo = async (program: Program) => {
            return {
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
            program = createProgram(organization)
            await program.save()
            programDetails = await programInfo(program)
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            it('fails to list programs in the organization', async () => {
                await expect(
                    listPrograms(testClient, organization.organization_id, {
                        authorization: undefined,
                    })
                ).to.be.rejected

                const dbprograms = await Program.find({
                    where: {
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })
                const dprogramsDetails = await Promise.all(
                    dbprograms.map(programInfo)
                )
                expect(dprogramsDetails).to.deep.eq([programDetails])
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view program permissions',
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

                    it('fails to list programs in the organization', async () => {
                        await expect(
                            listPrograms(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbprograms = await Program.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        const dprogramsDetails = await Promise.all(
                            dbprograms.map(programInfo)
                        )
                        expect(dprogramsDetails).to.deep.eq([programDetails])
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
                        PermissionName.view_program_20111,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                })

                it('lists all the programs in the organization', async () => {
                    const gqlprograms = await listPrograms(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )

                    const gqlprogramsDetails = await Promise.all(
                        gqlprograms.map(programInfo)
                    )
                    expect(gqlprogramsDetails).to.deep.eq([programDetails])
                })
                context('and the user is inactive', () => {
                    beforeEach(async () => {
                        const dbUser = await User.findOneOrFail(user.user_id)
                        if (dbUser) {
                            dbUser.status = Status.INACTIVE
                            await connection.manager.save(dbUser)
                        }
                    })
                    it('fails to list programs in the organization', async () => {
                        await expect(
                            listPrograms(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        ).to.be.rejected

                        const dbprograms = await Program.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        const dprogramsDetails = await Promise.all(
                            dbprograms.map(programInfo)
                        )
                        expect(dprogramsDetails).to.deep.eq([programDetails])
                    })
                })
            })
        })
    })

    describe('getClasses', () => {
        let user: User
        let userToken: string
        let organization: Organization
        let class1: Class
        let class2: Class
        let class3: Class
        let organizationId: string
        let school1: School
        let school2: School
        let school1Id: string
        let school2Id: string
        let systemRoles: any
        let arbitraryUserToken: string

        beforeEach(async () => {
            systemRoles = await getSystemRoleIds()
            const orgOwner = await createAdminUser(testClient)
            await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()
            user = await createNonAdminUser(testClient)
            userToken = getNonAdminAuthToken()
            organization = await createOrganizationAndValidate(
                testClient,
                orgOwner.user_id
            )
            organizationId = organization?.organization_id

            class1 = await createClass(
                testClient,
                organization.organization_id,
                'class1',
                'CLASS1',
                { authorization: getAdminAuthToken() }
            )

            class2 = await createClass(
                testClient,
                organization.organization_id,
                'class2',
                'CLASS2',
                { authorization: getAdminAuthToken() }
            )

            class3 = await createClass(
                testClient,
                organization.organization_id,
                undefined,
                undefined,
                {
                    authorization: getAdminAuthToken(),
                }
            )

            school1 = await createSchool(
                testClient,
                organizationId,
                'school 1',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            school1Id = school1?.school_id
            school2 = await createSchool(
                testClient,
                organizationId,
                'school 2',
                undefined,
                { authorization: getAdminAuthToken() }
            )
            school2Id = school2?.school_id

            await addSchoolToClass(testClient, class1.class_id, school1Id, {
                authorization: getAdminAuthToken(),
            })

            await addSchoolToClass(testClient, class2.class_id, school2Id, {
                authorization: getAdminAuthToken(),
            })

            await addUserToOrganizationAndValidate(
                testClient,
                user.user_id,
                organization.organization_id,
                { authorization: getAdminAuthToken() }
            )
        })

        context('when not authenticated', () => {
            it('returns an empty array', async () => {
                const gqlClasses = await listClasses(
                    testClient,
                    organization.organization_id,
                    {
                        authorization: arbitraryUserToken,
                    }
                )

                expect(gqlClasses).to.deep.equal([])
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view classes permissions',
                () => {
                    beforeEach(async () => {
                        const role = await createRole(
                            testClient,
                            organization.organization_id,
                            getAdminAuthToken()
                        )
                        await addRoleToOrganizationMembership(
                            testClient,
                            user.user_id,
                            organization.organization_id,
                            role.role_id,
                            {
                                authorization: getAdminAuthToken(),
                            }
                        )
                    })

                    it('returns an empty array', async () => {
                        const gqlClasses = await listClasses(
                            testClient,
                            organization.organization_id,
                            { authorization: userToken }
                        )

                        expect(gqlClasses).to.deep.equal([])
                    })
                }
            )
            context('and the user is a school admin', () => {
                beforeEach(async () => {
                    const schoolAdminRoleId = systemRoles['School Admin']

                    await addUserToSchool(testClient, user.user_id, school1Id, {
                        authorization: getAdminAuthToken(),
                    })
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organization.organization_id,
                        schoolAdminRoleId,
                        {
                            authorization: getAdminAuthToken(),
                        }
                    )
                })

                it('lists the Classes in the school', async () => {
                    const gqlClasses = await listClasses(
                        testClient,
                        organization.organization_id,
                        { authorization: userToken }
                    )
                    expect(gqlClasses.length).to.equal(1)
                    expect(gqlClasses[0].class_id).to.equal(class1.class_id)
                })
                context(
                    'and the user has Organization Admin the permissions',
                    () => {
                        beforeEach(async () => {
                            const orgAdminRoleId =
                                systemRoles['Organization Admin']

                            await addUserToSchool(
                                testClient,
                                user.user_id,
                                school1Id,
                                {
                                    authorization: getAdminAuthToken(),
                                }
                            )

                            await addRoleToOrganizationMembership(
                                testClient,
                                user.user_id,
                                organization.organization_id,
                                orgAdminRoleId,
                                { authorization: getAdminAuthToken() }
                            )
                        })

                        it('lists all the classes in the organization, including classes without a school', async () => {
                            const gqlClasses = await listClasses(
                                testClient,
                                organization.organization_id,
                                { authorization: userToken }
                            )

                            expect(
                                gqlClasses.map((cls) => cls.class_id)
                            ).to.deep.equalInAnyOrder([
                                class1.class_id,
                                class2.class_id,
                                class3.class_id,
                            ])
                        })
                    }
                )
            })
        })
    })

    describe('.memberships', () => {
        beforeEach(async () => {
            nonAdminUser = await createUser().save()
            organization = await createOrganization().save()
        })

        context('when there is a membership on the organisation', () => {
            beforeEach(async () => {
                await createOrganizationMembership({
                    user: nonAdminUser,
                    organization,
                }).save()
            })

            it('finds the membership', async () => {
                const res: OrganizationMembership = await expect(
                    organization.membership({
                        user_id: nonAdminUser.user_id,
                    })
                ).to.be.fulfilled
                expect(res).to.be.instanceOf(OrganizationMembership)
                expect(res.user_id).to.equal(nonAdminUser.user_id)
                expect(res.organization_id).to.equal(
                    organization.organization_id
                )
            })
        })

        context('when there is no membership on the organisation', () => {
            it('throws an EntityNotFound error', async () => {
                const res: EntityNotFoundError = await expect(
                    organization.membership({
                        user_id: nonAdminUser.user_id,
                    })
                ).to.be.rejected
                expect(res).to.be.instanceOf(EntityNotFoundError)
            })
        })
    })

    describe('.roles', () => {
        let res: Role[]
        beforeEach(async () => {
            await createUser().save()
            organization = await createOrganization().save()
        })

        context('when a non-system role exists on the organisation', () => {
            beforeEach(async () => {
                role = await roleFactory(undefined, organization).save()
                res = await expect(organization.roles()).to.be.fulfilled
            })

            it('finds the non-system role', () => {
                const nonSystemRoles: Role[] = res.filter((r) => !r.system_role)
                expect(nonSystemRoles).to.have.length(1)
                const nonSystemRole: Role = nonSystemRoles[0]
                expect(nonSystemRole).to.be.instanceOf(Role)
                expect(nonSystemRole.role_id).to.equal(role.role_id)
            })

            it('finds the system roles', () => {
                const systemRoles: Role[] = res.filter((r) => r.system_role)
                expect(systemRoles).to.have.length(5)
                systemRoles.forEach((sr) => expect(sr).to.be.instanceOf(Role))
            })
        })

        context('when no non-system roles exist on the organisation', () => {
            beforeEach(async () => {
                res = await expect(organization.roles()).to.be.fulfilled
            })

            it('finds no non-system roles', () => {
                const nonSystemRoles: Role[] = res.filter((r) => !r.system_role)
                expect(nonSystemRoles).to.be.empty
            })

            it('finds the system roles', () => {
                const systemRoles: Role[] = res.filter((r) => r.system_role)
                expect(systemRoles).to.have.length(5)
                systemRoles.forEach((sr) => expect(sr).to.be.instanceOf(Role))
            })
        })
    })

    describe('AddUsersToOrganizations', () => {
        let input: AddUsersToOrganizationInput[]

        function addUsers(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return mutate(AddUsersToOrganizations, { input }, permissions)
        }

        async function checkOutput() {
            for (const orgInputs of input) {
                const {
                    organizationId,
                    userIds,
                    organizationRoleIds,
                } = orgInputs

                // eslint-disable-next-line no-await-in-loop
                const dbMemberships = await OrganizationMembership.find({
                    where: {
                        organization_id: organizationId,
                        user_id: In(userIds),
                        status: Status.ACTIVE,
                    },
                })

                // Check that user ids match
                const dbUserIds = new Set(
                    dbMemberships.map((val) => val.user_id)
                )
                const userIdsSet = new Set(userIds)

                expect(dbUserIds.size).to.equal(userIdsSet.size)
                dbUserIds.forEach(
                    (val) => expect(userIdsSet.has(val)).to.be.true
                )

                // Check that each entry has the same set of roles
                for (const membership of dbMemberships) {
                    const dbRoles = new Set(
                        // eslint-disable-next-line no-await-in-loop
                        (await membership.roles)?.map((val) => val.role_id)
                    )
                    const inputRoles = new Set(organizationRoleIds)
                    expect(dbRoles.size).to.equal(inputRoles.size)
                    dbRoles.forEach(
                        (val) => expect(inputRoles.has(val)).to.be.true
                    )
                }
            }
        }

        async function checkNoChangesMade() {
            expect(
                await OrganizationMembership.find({
                    where: {
                        organization_id: In(orgs.map((o) => o.organization_id)),
                        user_id: In(users.map((u) => u.user_id)),
                        status: Status.ACTIVE,
                    },
                })
            ).to.be.empty
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            orgs = createOrganizations(3)
            users = createUsers(3)
            roles = createRoles(3)
            await Organization.save(orgs)
            await connection.manager.save([...users, ...roles])

            input = [
                {
                    organizationId: orgs[0].organization_id,
                    userIds: [users[0].user_id],
                    organizationRoleIds: [roles[0].role_id, roles[1].role_id],
                },
                {
                    organizationId: orgs[1].organization_id,
                    userIds: [users[1].user_id, users[2].user_id],
                    organizationRoleIds: [roles[1].role_id, roles[2].role_id],
                },
                {
                    organizationId: orgs[2].organization_id,
                    userIds: [users[0].user_id, users[2].user_id],
                    organizationRoleIds: [roles[2].role_id],
                },
            ]
        })

        context(
            'when caller has permissions to add users to organizations',
            () => {
                context('and all attributes are valid', () => {
                    it('adds all the users', async () => {
                        await expect(addUsers()).to.be.fulfilled
                        await checkOutput()
                    })

                    it('makes the expected number of db calls', async () => {
                        connection.logger.reset()
                        await expect(addUsers()).to.be.fulfilled
                        expect(connection.logger.count).to.equal(10) // preload: 4, authorize: 1, save: 1 per membership
                    })
                })

                context('and one of the users was already added', () => {
                    beforeEach(async () => {
                        await createOrganizationMembership({
                            user: users[0],
                            organization: orgs[0],
                            roles: [roles[1], roles[2]],
                        }).save()
                    })

                    it('returns an existent_child_entity error', async () => {
                        const res = await expect(addUsers()).to.be.rejected
                        expectAPIError.existent_child_entity(
                            res,
                            {
                                entity: 'User',
                                entityName: users[0].user_id,
                                parentEntity: 'Organization',
                                parentName: orgs[0].organization_id,
                                index: 0,
                            },
                            [''],
                            0,
                            1
                        )
                    })
                })

                context('and one of the users is inactive', async () => {
                    beforeEach(
                        async () => await users[1].inactivate(getManager())
                    )

                    it('returns an nonexistent_entity error', async () => {
                        const res = await expect(addUsers()).to.be.rejected
                        expectAPIError.nonexistent_entity(
                            res,
                            {
                                entity: 'User',
                                entityName: users[1].user_id,
                                index: 1,
                            },
                            ['id'],
                            0,
                            1
                        )
                        await checkNoChangesMade()
                    })
                })

                context('and one of the roles is inactive', async () => {
                    beforeEach(
                        async () => await roles[0].inactivate(getManager())
                    )

                    it('returns an nonexistent_entity error', async () => {
                        const res = await expect(addUsers()).to.be.rejected
                        expectAPIError.nonexistent_entity(
                            res,
                            {
                                entity: 'Role',
                                entityName: roles[0].role_id,
                                index: 0,
                            },
                            ['id'],
                            0,
                            1
                        )
                        await checkNoChangesMade()
                    })
                })

                context('and one of each attribute is inactive', async () => {
                    beforeEach(async () => {
                        await Promise.all([
                            orgs[2].inactivate(getManager()),
                            users[1].inactivate(getManager()),
                            roles[0].inactivate(getManager()),
                        ])
                    })

                    it('returns several nonexistent_entity errors', async () => {
                        const res = await expect(addUsers()).to.be.rejected
                        const expectedErrors = [
                            {
                                entity: 'Organization',
                                id: orgs[2].organization_id,
                                entryIndex: 2,
                            },
                            {
                                entity: 'Role',
                                id: roles[0].role_id,
                                entryIndex: 0,
                            },
                            {
                                entity: 'User',
                                id: users[1].user_id,
                                entryIndex: 1,
                            },
                        ]
                        expectedErrors.forEach((ee, errorIndex) => {
                            expectAPIError.nonexistent_entity(
                                res,
                                {
                                    entity: ee.entity,
                                    entityName: ee.id,
                                    index: ee.entryIndex,
                                },
                                ['id'],
                                errorIndex,
                                expectedErrors.length
                            )
                        })
                        await checkNoChangesMade()
                    })
                })
            }
        )

        context(
            'when caller does not have permissions to add users to all organizations',
            async () => {
                const permission = PermissionName.send_invitation_40882
                beforeEach(async () => {
                    const nonAdminRole = await roleFactory(
                        'Non Admin Role',
                        orgs[0],
                        { permissions: [permission] }
                    ).save()
                    await createOrganizationMembership({
                        user: nonAdminUser,
                        organization: orgs[0],
                        roles: [nonAdminRole],
                    }).save()
                })

                it('returns a permission error', async () => {
                    const permOrgs = [orgs[1], orgs[2]]
                    await expect(addUsers(nonAdminUser)).to.be.rejectedWith(
                        buildPermissionError(permission, nonAdminUser, permOrgs)
                    )
                    await checkNoChangesMade()
                })
            }
        )
    })

    describe('RemoveUsersFromOrganizations', () => {
        let input: RemoveUsersFromOrganizationInput[]

        function removeUsers(authUser = adminUser) {
            const permissions = new UserPermissions(userToPayload(authUser))
            return mutate(RemoveUsersFromOrganizations, { input }, permissions)
        }

        async function checkOutput() {
            for (const orgInputs of input) {
                const { organizationId, userIds } = orgInputs

                // eslint-disable-next-line no-await-in-loop
                const dbMemberships = await OrganizationMembership.find({
                    where: {
                        organization_id: organizationId,
                        user_id: In(userIds),
                        status: Status.INACTIVE,
                    },
                })

                // Check that user ids match
                const dbUserIds = new Set(
                    dbMemberships.map((val) => val.user_id)
                )
                const userIdsSet = new Set(userIds)

                expect(dbUserIds.size).to.equal(userIdsSet.size)
                dbUserIds.forEach(
                    (val) => expect(userIdsSet.has(val)).to.be.true
                )
            }
        }

        async function checkNoChangesMade(inactivateCount = 0) {
            expect(
                await OrganizationMembership.find({
                    where: {
                        organization_id: In(orgs.map((o) => o.organization_id)),
                        user_id: In(users.map((u) => u.user_id)),
                        status: Status.INACTIVE,
                    },
                })
            ).to.have.length(inactivateCount)
        }

        async function inactivateMembership(
            user_id: string,
            organization_id: string
        ) {
            const membership = await OrganizationMembership.findOneOrFail({
                where: { organization_id, user_id },
            })
            await membership.inactivate(getManager())
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            nonAdminUser = await createNonAdminUser(testClient)
            orgs = createOrganizations(3)
            users = createUsers(3)
            await Organization.save(orgs)
            await User.save(users)

            // Generate input & create memberships
            input = []
            const memberships: OrganizationMembership[] = []
            const userIndexGroups = [[0], [1, 2], [0, 2]]
            for (const [orgIdx, userIndexes] of userIndexGroups.entries()) {
                const org = orgs[orgIdx]
                const userIds: string[] = []
                for (const uIdx of userIndexes) {
                    userIds.push(users[uIdx].user_id)
                    memberships.push(
                        createOrganizationMembership({
                            user: users[uIdx],
                            organization: org,
                        })
                    )
                }
                input.push({ organizationId: org.organization_id, userIds })
            }
            await OrganizationMembership.save(memberships)
        })

        context(
            'when caller has permissions to remove users from organizations',
            () => {
                context('and all attributes are valid', () => {
                    it('removes all the users', async () => {
                        await expect(removeUsers()).to.be.fulfilled
                        await checkOutput()
                    })

                    it('returns the expected output', async () => {
                        const res: OrganizationsMutationResult = await expect(
                            removeUsers()
                        ).to.be.fulfilled
                        const orgIds = new Set(
                            res.organizations.map((o) => o.id)
                        )
                        expect(orgIds).to.have.length(input.length)
                        input.forEach(
                            (i) =>
                                expect(orgIds.has(i.organizationId)).to.be.true
                        )
                    })

                    it('makes the expected number of database calls', async () => {
                        connection.logger.reset()
                        await expect(removeUsers()).to.be.fulfilled
                        expect(connection.logger.count).to.equal(5) // preload: 3, authorize: 1, save: 1
                    })
                })

                context('and one of the users was already removed', () => {
                    beforeEach(() =>
                        inactivateMembership(
                            users[0].user_id,
                            orgs[0].organization_id
                        )
                    )

                    it('returns a nonexistent_child error', async () => {
                        const res = await expect(removeUsers()).to.be.rejected
                        expectAPIError.nonexistent_child(
                            res,
                            {
                                entity: 'User',
                                entityName: users[0].user_id,
                                parentEntity: 'Organization',
                                parentName: orgs[0].organization_id,
                                index: 0,
                            },
                            [''],
                            0,
                            1
                        )
                        await checkNoChangesMade(1)
                    })

                    it('does not perform any changes', async () => {
                        await checkNoChangesMade(1) // one membership is inactivated in the beforeEach
                        await expect(removeUsers()).to.be.rejected
                        await checkNoChangesMade(1)
                    })
                })

                context('and one of the users is inactive', async () => {
                    beforeEach(() => users[1].inactivate(getManager()))

                    it('returns a nonexistent_entity error', async () => {
                        const res = await expect(removeUsers()).to.be.rejected
                        expectAPIError.nonexistent_entity(
                            res,
                            {
                                entity: 'User',
                                entityName: users[1].user_id,
                                index: 1,
                            },
                            ['id'],
                            0,
                            1
                        )
                        await checkNoChangesMade(1) // inactivating a user also inactivates its memberships
                    })
                })

                context('and one of each attribute is inactive', async () => {
                    beforeEach(async () => {
                        await Promise.all([
                            orgs[2].inactivate(getManager()),
                            users[1].inactivate(getManager()),
                        ])
                    })

                    it('returns several nonexistent_entity errors', async () => {
                        const res = await expect(removeUsers()).to.be.rejected
                        expectAPIError.nonexistent_entity(
                            res,
                            {
                                entity: 'User',
                                entityName: users[1].user_id,
                                index: 1,
                            },
                            ['id'],
                            1,
                            2
                        )
                        expectAPIError.nonexistent_entity(
                            res,
                            {
                                entity: 'Organization',
                                entityName: orgs[2].organization_id,
                                index: 2,
                            },
                            ['id'],
                            0,
                            2
                        )
                        await checkNoChangesMade(3) // 2 from orgs[2] + 1 from users[1]
                    })
                })
            }
        )

        context(
            'when caller does not have permissions to remove users from all organizations',
            async () => {
                const permission = PermissionName.edit_this_organization_10330
                beforeEach(async () => {
                    const nonAdminRole = await roleFactory(
                        'Non Admin Role',
                        orgs[0],
                        { permissions: [permission] }
                    ).save()
                    await createOrganizationMembership({
                        user: nonAdminUser,
                        organization: orgs[0],
                        roles: [nonAdminRole],
                    }).save()
                })

                it('returns a permission error', async () => {
                    const permOrgs = [orgs[1], orgs[2]]
                    await expect(removeUsers(nonAdminUser)).to.be.rejectedWith(
                        buildPermissionError(permission, nonAdminUser, permOrgs)
                    )
                    await checkNoChangesMade()
                })
            }
        )
    })
})
