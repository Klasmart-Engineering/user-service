import { expect, use } from 'chai'
import faker from 'faker'
import { Connection } from 'typeorm'
import { Model } from '../../src/model'
import { createTestConnection } from '../utils/testConnection'
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
import { createUserAndValidate, myUsers } from '../utils/operations/modelOps'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import {
    getSchoolMembershipsForOrganizationMembership,
    addRoleToOrganizationMembership,
} from '../utils/operations/organizationMembershipOps'
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
import { createSubject } from '../factories/subject.factory'
import chaiAsPromised from 'chai-as-promised'
import { isRequiredArgument } from 'graphql'
import { Program } from '../../src/entities/program'
import { createProgram } from '../factories/program.factory'
import { SHORTCODE_DEFAULT_MAXLEN } from '../../src/utils/shortcode'
import RoleInitializer from '../../src/initializers/roles'
import { studentRole } from '../../src/permissions/student'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { Class } from '../../src/entities/class'
import { addSchoolToClass } from '../utils/operations/classOps'
import { AnyKindOfDictionary } from 'lodash'
import { validationConstants } from '../../src/entities/validations/constants'

use(chaiAsPromised)

describe('organization', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let user: User
    let originalAdmins: string[]
    let organization: Organization
    let role: Role
    const shortcode_re = /^[A-Z|0-9]+$/
    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
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

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
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
                    mods
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
                const fn = () =>
                    updateOrganization(testClient, organizationId, mods, {
                        authorization: authTokenOfUserMakingMod,
                    })
                expect(fn()).to.be.rejected
                const dbOrg = await Organization.findOneOrFail(organizationId)
                expect(dbOrg).to.not.include(mods)
            })
        })
    })

    describe('findOrCreateUser', async () => {
        beforeEach(async () => {
            user = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
            )
        })

        it('the organization status by default is active', async () => {
            expect(organization.status).to.eq(Status.ACTIVE)
        })

        it('should assign the old user to the exsting user', async () => {
            let oldUser: User
            let email = user.email ?? ''
            oldUser = await organization['findOrCreateUser'](
                true,
                user.user_id,
                email,
                undefined,
                user.given_name,
                user.family_name
            )
            expect(oldUser).to.exist
            expect(oldUser.user_id).to.equal(user.user_id)
        })
        it('should assign the new user to a new user with an email', async () => {
            let newUser: User
            newUser = await organization['findOrCreateUser'](
                false,
                undefined,
                'bob@nowhere.com',
                undefined,
                'Bob',
                'Smith'
            )
            expect(newUser).to.exist
            expect(newUser.email).to.equal('bob@nowhere.com')
        })

        it('should assign the new user to a new user with a phone number', async () => {
            let newUser: User
            newUser = await organization['findOrCreateUser'](
                false,
                undefined,
                undefined,
                '+44207344141',
                'Bob',
                'Smith'
            )
            expect(newUser).to.exist
            expect(newUser.phone).to.equal('+44207344141')
        })
    })

    describe('membershipOrganization', async () => {
        context('we have a user and an organization', () => {
            let userId: string
            let organizationId: string
            let schoolId: string
            beforeEach(async () => {
                user = await createAdminUser(testClient)
                userId = user.user_id
                organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
                organizationId = organization.organization_id
                role = await createRole(
                    testClient,
                    organization.organization_id,
                    'student'
                )
            })
            it('Should set the user as a member of the organization', async () => {
                let membership = await organization['membershipOrganization'](
                    user,
                    new Array(role)
                )
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(userId)
            })
        })
    })

    describe('createClass', async () => {
        let userId: string
        let organizationId: string
        let classInfo = (cls: any) => {
            return cls.class_id
        }

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            userId = user.user_id
            organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
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
                    const fn = () =>
                        createClass(
                            testClient,
                            organizationId,
                            'Some Class 1',
                            'very horrid',
                            { authorization: getAdminAuthToken() }
                        )
                    expect(fn()).to.be.rejected
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
        let userId: string
        let organizationId: string
        let schoolInfo = (school: any) => {
            return school.school_id
        }

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            userId = user.user_id
            organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
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
                    const fn = () =>
                        createSchool(
                            testClient,
                            organizationId,
                            'some school 1',
                            'myverywrong1',
                            { authorization: getAdminAuthToken() }
                        )
                    expect(fn()).to.be.rejected
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

            context(
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
            let userId: string
            let organizationId: string
            let schoolId: string
            beforeEach(async () => {
                user = await createAdminUser(testClient)
                userId = user.user_id
                organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
                organizationId = organization.organization_id
                role = await createRole(
                    testClient,
                    organization.organization_id,
                    'student'
                )
                schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'school 1',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                ).school_id
                await addUserToOrganizationAndValidate(
                    testClient,
                    userId,
                    organizationId,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('should set the school in the schools membership for the user', async () => {
                let schoolmemberships: SchoolMembership[]
                let oldSchoolMemberships: SchoolMembership[]
                ;[schoolmemberships, oldSchoolMemberships] = await organization[
                    'membershipSchools'
                ](user, new Array(schoolId), new Array(role))
                expect(oldSchoolMemberships).to.exist
                expect(oldSchoolMemberships).to.be.empty
                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(userId)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
            })
        })
    })

    describe('_setMembership', async () => {
        context(
            'We have an email, given_name, family_name, organization_role_ids, school_ids and school_role_ids',
            () => {
                let userId: string
                let organizationId: string
                let schoolId: string
                let roleId: string

                beforeEach(async () => {
                    user = await createAdminUser(testClient)
                    userId = user.user_id
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    organizationId = organization.organization_id
                    role = await Role.findOneOrFail({
                        where: { role_name: 'Student' },
                    })
                    roleId = role.role_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                })

                it('should create the user, make the user a member of the organization and set the school in the schools membership for the user', async () => {
                    let object = await organization['_setMembership'](
                        false,
                        false,
                        undefined,
                        undefined,
                        '+44207344141',
                        'Bob',
                        'Smith',
                        undefined,
                        'Bunter',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId)
                    )

                    let newUser = object.user
                    let membership = object.membership
                    let schoolmemberships = object.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser.phone).to.equal('+44207344141')
                    expect(newUser.gender).to.equal('Male')
                    expect(schoolmemberships).to.exist
                    if (schoolmemberships) {
                        expect(schoolmemberships.length).to.equal(1)
                        expect(schoolmemberships[0].user_id).to.equal(
                            newUser.user_id
                        )
                        expect(schoolmemberships[0].school_id).to.equal(
                            schoolId
                        )
                    }
                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })
                it('should create the user, make the user a member of the organization and set the school in the schools membership for the user', async () => {
                    let object = await organization['_setMembership'](
                        false,
                        false,
                        undefined,
                        'bob@nowhere.com',
                        undefined,
                        'Bob',
                        'Smith',
                        undefined,
                        'Bunter',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId)
                    )

                    let newUser = object.user
                    let membership = object.membership
                    let schoolmemberships = object.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser.email).to.equal('bob@nowhere.com')
                    expect(newUser.gender).to.equal('Male')

                    expect(schoolmemberships).to.exist
                    if (schoolmemberships) {
                        expect(schoolmemberships.length).to.equal(1)
                        expect(schoolmemberships[0].user_id).to.equal(
                            newUser.user_id
                        )
                        expect(schoolmemberships[0].school_id).to.equal(
                            schoolId
                        )
                    }
                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })
                it('should find the user, make the user a member of the organization and set the school in the schools membership for the user', async () => {
                    let email = user.email ?? 'anyone@email.com'
                    let given = user.given_name ?? 'anyone'
                    let family = user.family_name ?? 'at_all'
                    let object = await organization['_setMembership'](
                        false,
                        true,
                        user.user_id,
                        email,
                        undefined,
                        given,
                        family,
                        undefined,
                        user.username,
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId)
                    )

                    let newUser = object.user
                    let membership = object.membership
                    let schoolmemberships = object.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser.user_id).to.equal(user.user_id)
                    expect(newUser.gender).to.equal('Male')

                    expect(schoolmemberships).to.exist
                    if (schoolmemberships) {
                        expect(schoolmemberships.length).to.equal(1)
                        expect(schoolmemberships[0].user_id).to.equal(
                            newUser.user_id
                        )
                        expect(schoolmemberships[0].school_id).to.equal(
                            schoolId
                        )
                    }
                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })
            }
        )
        context(
            'We have an email, given_name, family_name, organization_role_ids, school_ids and school_role_ids and the user already is another school member',
            () => {
                let userId: string
                let organizationId: string
                let schoolId: string
                let oldSchoolId: string
                let roleId: string
                beforeEach(async () => {
                    user = await createAdminUser(testClient)
                    userId = user.user_id
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    organizationId = organization.organization_id
                    role = await createRole(
                        testClient,
                        organization.organization_id,
                        'student'
                    )
                    roleId = role.role_id
                    oldSchoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 2',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    await addUserToSchool(testClient, userId, oldSchoolId, {
                        authorization: getAdminAuthToken(),
                    })
                })
                it('should find the user, make the user a member of the organization and set the school in the schools membership for the user', async () => {
                    let email = user.email
                    let given = user.given_name
                    let family = user.family_name
                    let object = await organization['_setMembership'](
                        false,
                        true,
                        user.user_id,
                        email,
                        undefined,
                        given,
                        family,
                        undefined,
                        user.username,
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId)
                    )

                    let newUser = object.user
                    let membership = object.membership
                    let schoolmemberships = object.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser.user_id).to.equal(user.user_id)
                    expect(newUser.gender).to.equal('Male')

                    expect(schoolmemberships).to.exist
                    if (schoolmemberships) {
                        expect(schoolmemberships.length).to.equal(1)
                        expect(schoolmemberships[0].user_id).to.equal(
                            newUser.user_id
                        )
                        expect(schoolmemberships[0].school_id).to.equal(
                            schoolId
                        )
                    }
                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                    expect(membership.shortcode).to.match(shortcode_re)
                    expect(membership.shortcode.length).to.equal(
                        validationConstants.SHORTCODE_MAX_LENGTH
                    )

                    const gqlSchoolMemberships = await getSchoolMembershipsForOrganizationMembership(
                        testClient,
                        userId,
                        organizationId
                    )
                    expect(gqlSchoolMemberships).to.have.lengthOf(1)
                    expect(gqlSchoolMemberships[0].school_id).to.equal(schoolId)
                })
                it(' should find the user, make the user a member of the organization', async () => {
                    let email = user.email
                    let given = user.given_name
                    let family = user.family_name
                    let object = await organization['_setMembership'](
                        false,
                        true,
                        user.user_id,
                        email,
                        undefined,
                        given,
                        family,
                        undefined,
                        undefined,
                        'Male',
                        'FLAFEL3',
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId)
                    )

                    let newUser = object.user
                    let membership = object.membership
                    let schoolmemberships = object.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser.user_id).to.equal(user.user_id)

                    expect(schoolmemberships).to.exist
                    if (schoolmemberships) {
                        expect(schoolmemberships.length).to.equal(1)
                        expect(schoolmemberships[0].user_id).to.equal(
                            newUser.user_id
                        )
                        expect(schoolmemberships[0].school_id).to.equal(
                            schoolId
                        )
                    }
                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                    expect(membership.shortcode).to.match(shortcode_re)
                    expect(membership.shortcode).to.equal('FLAFEL3')
                })

                context(
                    'We find the user, make the user a member of the organization',
                    () => {
                        it('should set the school in the schools membership for the user', async () => {
                            let email = user.email
                            let given = user.given_name
                            let family = user.family_name
                            let object = await organization['_setMembership'](
                                false,
                                true,
                                user.user_id,
                                email,
                                undefined,
                                given,
                                family,
                                undefined,
                                undefined,
                                'Male',
                                undefined,
                                new Array(roleId),
                                Array(schoolId),
                                new Array(roleId)
                            )

                            let newUser = object.user
                            let membership = object.membership
                            let schoolmemberships = object.schoolMemberships

                            expect(newUser).to.exist
                            expect(newUser.user_id).to.equal(user.user_id)

                            expect(schoolmemberships).to.exist
                            if (schoolmemberships) {
                                expect(schoolmemberships.length).to.equal(1)
                                expect(schoolmemberships[0].user_id).to.equal(
                                    newUser.user_id
                                )
                                expect(schoolmemberships[0].school_id).to.equal(
                                    schoolId
                                )
                            }
                            expect(membership).to.exist
                            expect(membership.organization_id).to.equal(
                                organizationId
                            )
                            expect(membership.user_id).to.equal(newUser.user_id)
                            expect(membership.shortcode).to.match(shortcode_re)
                            expect(membership.shortcode.length).to.equal(
                                validationConstants.SHORTCODE_MAX_LENGTH
                            )

                            const gqlSchoolMemberships = await getSchoolMembershipsForOrganizationMembership(
                                testClient,
                                userId,
                                organizationId
                            )
                            expect(gqlSchoolMemberships).to.have.lengthOf(1)
                            expect(gqlSchoolMemberships[0].school_id).to.equal(
                                schoolId
                            )
                        })

                        it(' it should set a custom shortcode', async () => {
                            let email = user.email
                            let given = user.given_name
                            let family = user.family_name
                            let object = await organization['_setMembership'](
                                false,
                                false,
                                undefined,
                                email,
                                undefined,
                                given,
                                family,
                                undefined,
                                'Bunter',
                                'Male',
                                'FLAFEL3',
                                new Array(roleId),
                                Array(schoolId),
                                new Array(roleId)
                            )

                            let membership = object.membership

                            expect(membership).to.exist
                            expect(membership.shortcode).to.match(shortcode_re)
                            expect(membership.shortcode).to.equal('FLAFEL3')
                        })
                        it(' it should fail to set a custom shortcode', async () => {
                            let email = user.email
                            let given = user.given_name
                            let family = user.family_name
                            let object = await organization['_setMembership'](
                                false,
                                false,
                                undefined,
                                email,
                                undefined,
                                given,
                                family,
                                undefined,
                                'Bunter',
                                'Male',
                                'polkadot 45',
                                new Array(roleId),
                                Array(schoolId),
                                new Array(roleId)
                            )

                            let membership = object.membership

                            expect(membership).to.exist
                            expect(membership.organization_id).to.equal(
                                organizationId
                            )
                            expect(membership.shortcode).to.match(shortcode_re)
                            expect(membership.shortcode).to.not.equal(
                                'polkadot 45'
                            )
                        })
                        it(' it should uppercase a custom shortcode', async () => {
                            let email = user.email
                            let given = user.given_name
                            let family = user.family_name
                            let object = await organization['_setMembership'](
                                false,
                                false,
                                undefined,
                                email,
                                undefined,
                                given,
                                family,
                                undefined,
                                'Bunter',
                                'Male',
                                'polkadot45',
                                new Array(roleId),
                                Array(schoolId),
                                new Array(roleId)
                            )

                            let membership = object.membership

                            expect(membership).to.exist
                            expect(membership.organization_id).to.equal(
                                organizationId
                            )
                            expect(membership.shortcode).to.match(shortcode_re)
                            expect(membership.shortcode).to.not.equal(
                                'polkadot45'
                            )
                            expect(membership.shortcode).to.equal(
                                'polkadot45'.toUpperCase()
                            )
                        })
                    }
                )
                it('should attempt to assign a role for one organizion to another and not succeed', async () => {
                    let user2 = await createNonAdminUser(testClient)
                    let userId2 = user2.user_id
                    let organization2 = await createOrganizationAndValidate(
                        testClient,
                        userId2,
                        'otherOrgName',
                        undefined,
                        getNonAdminAuthToken()
                    )
                    let organizationId2 = organization2.organization_id
                    role = await createRole(
                        testClient,
                        organization.organization_id,
                        'student'
                    )
                    roleId = role.role_id
                    let role2 = await createRole(
                        testClient,
                        organizationId2,
                        'student',
                        'student role',
                        getNonAdminAuthToken()
                    )
                    let role2id = role2.role_id
                    let email = user.email
                    let given = user.given_name
                    let family = user.family_name
                    try {
                        let object = await organization['_setMembership'](
                            false,
                            false,
                            undefined,
                            email,
                            undefined,
                            given,
                            family,
                            undefined,
                            'Bunter',
                            'Male',
                            undefined,
                            [roleId, role2id],
                            Array(schoolId),
                            new Array(roleId)
                        )
                        expect(false).true
                    } catch (e) {
                        expect(e).to.exist
                    }
                })
            }
        )
    })

    describe('inviteUser', async () => {
        context(
            'We have an email or phone, profile_name, given_name, family_name, date_of_birth, organization_role_ids, school_ids, school_role_ids, alternate_email, alternate_phone',
            () => {
                let userId: string
                let organizationId: string
                let schoolId: string
                let oldSchoolId: string
                let roleId: string
                let otherUserId: string
                let adminToken: string

                beforeEach(async () => {
                    user = await createAdminUser(testClient)
                    adminToken = generateToken(userToPayload(user))
                    otherUserId = (await createNonAdminUser(testClient)).user_id
                    userId = user.user_id
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    organizationId = organization.organization_id
                    role = await Role.findOneOrFail({
                        where: { role_name: 'Student' },
                    })
                    roleId = role.role_id
                    oldSchoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 1',
                            undefined,
                            { authorization: adminToken }
                        )
                    ).school_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 2',
                            undefined,
                            { authorization: adminToken }
                        )
                    ).school_id
                    await addUserToSchool(testClient, userId, oldSchoolId, {
                        authorization: adminToken,
                    })
                })

                it('creates the user when email provided', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '02-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Bunter',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser?.email).to.equal(email)
                    expect(newUser?.date_of_birth).to.equal(dateOfBirth)
                    expect(newUser?.username).to.equal('Bunter')
                    expect(newUser?.gender).to.equal('Male')

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser?.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser?.user_id)
                    expect(membership.shortcode).to.match(shortcode_re)
                    expect(membership.shortcode.length).to.equal(
                        validationConstants.SHORTCODE_MAX_LENGTH
                    )
                })

                it('creates the user when no lowercase email provided', async () => {
                    const expectedEmail = 'bob.dylan@nowhere.com'
                    let email = 'Bob.Dylan@NOWHERE.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '2-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser?.email).to.equal(expectedEmail)
                    expect(newUser?.date_of_birth).to.equal('02-1978')
                    expect(newUser?.username).to.equal('Buster')
                    expect(newUser?.gender).to.equal('Male')

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser?.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser?.user_id)
                })

                it('creates the user when email provided as phone', async () => {
                    let email = undefined
                    let phone = 'bob.dylan@nowhere.com'
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '21-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(newUser).to.exist

                    expect(newUser.email).to.eq(phone)
                    expect(newUser.phone).to.be.null
                    expect(newUser.date_of_birth).to.be.null
                    expect(newUser.username).to.equal('Buster')
                    expect(newUser?.gender).to.equal('Male')

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser?.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser?.user_id)
                })

                it('creates the user when phone provided', async () => {
                    let email = undefined
                    let phone = '+44207344141'
                    let given = 'Bob'
                    let family = 'Smith'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser.phone).to.equal(phone)
                    expect(newUser?.username).to.equal('Buster')
                    expect(newUser?.gender).to.equal('Male')

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser?.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser?.user_id)
                })

                it('creates the user when phone provided as email', async () => {
                    let email = '+44207344141'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser.email).to.be.null
                    expect(newUser.phone).to.eq(email)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser?.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser?.user_id)
                })

                it('creates the user makes them linked to organization, they invite someone else', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '02-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Bunter',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser?.email).to.equal(email)
                    expect(newUser?.date_of_birth).to.equal(dateOfBirth)
                    expect(newUser?.username).to.equal('Bunter')

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser?.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser?.user_id)

                    const bobtoken = generateToken(userToPayload(newUser))
                    gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        'bob2@nowhere.com',
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: bobtoken }
                    )
                    newUser = gqlresult?.user
                    expect(newUser).to.exist
                    expect(newUser?.email).to.equal('bob2@nowhere.com')
                    expect(newUser?.date_of_birth).to.equal(dateOfBirth)
                    expect(newUser?.username).to.equal('Buster')
                    membership = gqlresult?.membership
                    expect(membership).to.exist
                    schoolmemberships = gqlresult?.schoolMemberships
                    expect(schoolmemberships).to.not.exist
                })

                it('creates user with custom shortcode', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '02-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Bunter',
                        'Male',
                        'RANGER13',
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.shortcode).to.match(shortcode_re)
                    expect(membership.shortcode).to.equal('RANGER13')
                })

                it('creates user with an uppercased custom shortcode', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '02-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Bunter',
                        'Male',
                        'ranger13',
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.shortcode).to.match(shortcode_re)
                    expect(membership.shortcode).to.equal('RANGER13')
                })

                it('creates user with a shortcode ignoring non validating custom input', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '02-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Bunter',
                        'Male',
                        'ranger 13',
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.shortcode).to.match(shortcode_re)
                    expect(membership.shortcode).to.not.equal('RANGER 13')
                })

                it('creates the user with alternate_email and altnernate_phone when provided', async () => {
                    let email = 'bob@nowhere.com'
                    let alternate_email = 'some@email.com'
                    let alternate_phone = '+123456789'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        'Bunter',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken },
                        alternate_email,
                        alternate_phone
                    )
                    let newUser = gqlresult?.user

                    expect(newUser).to.exist
                    expect(newUser?.email).to.equal(email)
                    expect(newUser?.alternate_email).to.equal(alternate_email)
                    expect(newUser?.alternate_phone).to.equal(alternate_phone)
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
                        let email = 'bob@nowhere.com'
                        let phone = undefined
                        let given = 'Bob'
                        let family = 'Smith'
                        let gqlresult = await inviteUser(
                            testClient,
                            organizationId,
                            email,
                            phone,
                            given,
                            family,
                            undefined,
                            'Buster',
                            'Male',
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: adminToken }
                        )
                        expect(gqlresult).to.be.null

                        const dbOrganization = await Organization.findOneOrFail(
                            { where: { organization_id: organizationId } }
                        )
                        const organizationMemberships = await dbOrganization.memberships
                        const dbOrganizationMembership = await OrganizationMembership.findOneOrFail(
                            {
                                where: {
                                    organization_id: organizationId,
                                    user_id: userId,
                                },
                            }
                        )

                        expect(organizationMemberships).to.deep.include(
                            dbOrganizationMembership
                        )
                    })
                })
            }
        )
        context(
            'We have an existing user and we invite to the same email or phone, etc ',
            () => {
                let userId: string
                let organizationId: string
                let schoolId: string
                let oldSchoolId: string
                let roleId: string
                let existingUser: User
                let newSchoolId: string
                let adminToken: string

                beforeEach(async () => {
                    user = await createAdminUser(testClient)
                    adminToken = generateToken(userToPayload(user))
                    userId = user.user_id
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    organizationId = organization.organization_id
                    role = await Role.findOneOrFail({
                        where: { role_name: 'Student' },
                    })
                    roleId = role.role_id
                    oldSchoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 2',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    await addUserToSchool(testClient, userId, oldSchoolId, {
                        authorization: getAdminAuthToken(),
                    })
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let dateOfBirth = '02-1978'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Bunter',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    existingUser = gqlresult?.user
                    expect(existingUser).to.exist
                    expect(existingUser?.email).to.equal(email)
                    newSchoolId = oldSchoolId
                })

                it('creates the user when email provided', async () => {
                    let email = existingUser.email
                    let phone = existingUser.phone
                    let given = 'Joanne'
                    let family = existingUser.family_name
                    let dateOfBirth = '04-2018'
                    let gqlresult = await inviteUser(
                        testClient,
                        organizationId,
                        email,
                        phone,
                        given,
                        family,
                        dateOfBirth,
                        'Jo',
                        'Female',
                        undefined,
                        new Array(roleId),
                        Array(newSchoolId),
                        new Array(roleId),
                        { authorization: adminToken }
                    )
                    let newUser = gqlresult?.user
                    let membership = gqlresult?.membership
                    let schoolmemberships = gqlresult?.schoolMemberships

                    expect(newUser).to.exist
                    expect(newUser?.email).to.equal(email)
                    expect(newUser?.date_of_birth).to.equal(dateOfBirth)
                    expect(newUser?.username).to.equal('Jo')

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser?.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(newSchoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser?.user_id)

                    const existingUserToken = generateToken(
                        userToPayload(existingUser)
                    )
                    const gqlMyUsers = await myUsers(testClient, {
                        authorization: existingUserToken,
                    })

                    expect(gqlMyUsers).to.exist
                    expect(gqlMyUsers.length).to.equal(2)
                })
            }
        )
    })
    describe('editMemberships', async () => {
        context(
            'We have an email or phone, given_name, family_name, organization_role_ids, school_ids and school_role_ids',
            () => {
                let userId: string
                let organizationId: string
                let schoolId: string
                let oldSchoolId: string
                let roleId: string
                let otherUserId: string
                let otherUser: User

                beforeEach(async () => {
                    user = await createAdminUser(testClient)
                    userId = user.user_id
                    otherUser = await createNonAdminUser(testClient)
                    otherUserId = otherUser.user_id
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    organizationId = organization.organization_id
                    role = await createRole(
                        testClient,
                        organization.organization_id,
                        'student'
                    )
                    roleId = role.role_id
                    oldSchoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 2',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    await addUserToSchool(testClient, userId, oldSchoolId, {
                        authorization: getAdminAuthToken(),
                    })
                })

                it('edits user when email provided', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'

                    let bob = {
                        given_name: given,
                        family_name: family,
                        email: email,
                    } as User

                    bob = await createUserAndValidate(testClient, bob)

                    let gqlresult = await editMembership(
                        testClient,
                        organizationId,
                        bob.user_id,
                        email,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult.user
                    let membership = gqlresult.membership
                    let schoolmemberships = gqlresult.schoolMemberships
                    expect(newUser).to.exist
                    expect(newUser.email).to.equal(email)
                    expect(newUser.user_id).to.equal(bob.user_id)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                    expect(membership.shortcode).to.match(shortcode_re)
                    expect(membership.shortcode.length).to.equal(
                        validationConstants.SHORTCODE_MAX_LENGTH
                    )
                })

                it('edits user when email provided as phone', async () => {
                    let email = undefined
                    let phone = 'bob.dylan@nowhere.com'
                    let given = 'Bob'
                    let family = 'Smith'
                    let bob = {
                        given_name: given,
                        family_name: family,
                        email: phone,
                    } as User
                    bob = await createUserAndValidate(testClient, bob)

                    let gqlresult = await editMembership(
                        testClient,
                        organizationId,
                        bob.user_id,
                        email,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult.user
                    let membership = gqlresult.membership
                    let schoolmemberships = gqlresult.schoolMemberships
                    expect(newUser).to.exist
                    expect(newUser.email).to.eq(phone)
                    expect(newUser.phone).to.be.null
                    expect(newUser.user_id).to.eq(bob.user_id)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })

                it('edits user when email provided', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let bob = {
                        given_name: given,
                        family_name: family,
                        email: email,
                    } as User
                    bob = await createUserAndValidate(testClient, bob)

                    let gqlresult = await editMembership(
                        testClient,
                        organizationId,
                        bob.user_id,
                        email,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult.user
                    let membership = gqlresult.membership
                    let schoolmemberships = gqlresult.schoolMemberships
                    expect(newUser).to.exist
                    expect(newUser.email).to.equal(email)
                    expect(newUser.user_id).to.eq(bob.user_id)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })

                it('edits user when phone provided', async () => {
                    let email = undefined
                    let phone = '+44207344141'
                    let given = 'Bob'
                    let family = 'Smith'
                    let bob = {
                        given_name: given,
                        family_name: family,
                        phone: phone,
                    } as User
                    bob = await createUserAndValidate(testClient, bob)
                    let gqlresult = await editMembership(
                        testClient,
                        organizationId,
                        bob.user_id,
                        email,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult.user
                    let membership = gqlresult.membership
                    let schoolmemberships = gqlresult.schoolMemberships
                    expect(newUser).to.exist
                    expect(newUser.phone).to.equal(phone)
                    expect(newUser.user_id).to.eq(bob.user_id)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })

                it('edits user when phone provided as email', async () => {
                    let email = '+44207344141'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let bob = {
                        given_name: given,
                        family_name: family,
                        phone: email,
                    } as User
                    bob = await createUserAndValidate(testClient, bob)
                    let gqlresult = await editMembership(
                        testClient,
                        organizationId,
                        bob.user_id,
                        email,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult.user
                    let membership = gqlresult.membership
                    let schoolmemberships = gqlresult.schoolMemberships
                    expect(newUser).to.exist
                    expect(newUser.email).to.be.null
                    expect(newUser.phone).to.eq(email)
                    expect(newUser.user_id).to.eq(bob.user_id)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })

                context('alternate_email and alternate_password', () => {
                    const email = 'bob@nowhere.com'
                    let bob: User

                    beforeEach(async () => {
                        bob = {
                            given_name: 'Bob',
                            family_name: 'Smith',
                            email: email,
                        } as User
                        bob = await createUserAndValidate(testClient, bob)
                    })

                    it('saves alternates if valid', async () => {
                        let alternate_email = 'a@a.com'
                        let alternate_phone = '+123456789'

                        let gqlresult = await editMembership(
                            testClient,
                            organizationId,
                            bob.user_id,
                            email,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: getAdminAuthToken() },
                            undefined,
                            alternate_email,
                            alternate_phone
                        )
                        let newUser = gqlresult.user
                        expect(newUser).to.exist
                        expect(newUser.email).to.equal(email)
                        expect(newUser.user_id).to.eq(bob.user_id)
                        expect(newUser.alternate_email).to.equal(
                            alternate_email
                        )
                        expect(newUser.alternate_phone).to.equal(
                            alternate_phone
                        )
                    })

                    it("doesn't save alternates if invalid", async () => {
                        let alternate_email = 'not-an-email'
                        let alternate_phone = 'not-a-phone-number'

                        let gqlresult = await editMembership(
                            testClient,
                            organizationId,
                            bob.user_id,
                            email,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: getAdminAuthToken() },
                            undefined,
                            alternate_email,
                            alternate_phone
                        )
                        let newUser = gqlresult.user
                        expect(newUser).to.exist
                        expect(newUser.email).to.equal(email)
                        expect(newUser.user_id).to.eq(bob.user_id)
                        expect(newUser.alternate_email).to.be.null
                        expect(newUser.alternate_phone).to.be.null
                    })

                    it('overwrites existing alternates if new ones are valid', async () => {
                        let alternate_email = 'a@a.com'
                        let alternate_phone = '+123456789'

                        await connection
                            .getRepository(User)
                            .update(bob.user_id, {
                                alternate_email: faker.internet.email(),
                                alternate_phone: faker.phone.phoneNumber(),
                            })

                        let gqlresult = await editMembership(
                            testClient,
                            organizationId,
                            bob.user_id,
                            email,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: getAdminAuthToken() },
                            undefined,
                            alternate_email,
                            alternate_phone
                        )
                        let newUser = gqlresult.user
                        expect(newUser).to.exist
                        expect(newUser.email).to.equal(email)
                        expect(newUser.user_id).to.eq(bob.user_id)
                        expect(newUser.alternate_email).to.equal(
                            alternate_email
                        )
                        expect(newUser.alternate_phone).to.equal(
                            alternate_phone
                        )
                    })

                    it('overwrites alternates with NULL if specified', async () => {
                        let alternate_email = 'a@a.com'
                        let alternate_phone = '+123456789'

                        await connection
                            .getRepository(User)
                            .update(bob.user_id, {
                                alternate_email,
                                alternate_phone,
                            })

                        let gqlresult = await editMembership(
                            testClient,
                            organizationId,
                            bob.user_id,
                            email,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: getAdminAuthToken() },
                            undefined,
                            null,
                            null
                        )
                        let newUser = gqlresult.user
                        expect(newUser).to.exist
                        expect(newUser.email).to.equal(email)
                        expect(newUser.user_id).to.eq(bob.user_id)
                        expect(newUser.alternate_email).to.be.null
                        expect(newUser.alternate_phone).to.be.null
                    })

                    it('normalises empty string alternates to NULL', async () => {
                        let alternate_email = 'a@a.com'
                        let alternate_phone = '+123456789'

                        await connection
                            .getRepository(User)
                            .update(bob.user_id, {
                                alternate_email,
                                alternate_phone,
                            })

                        let gqlresult = await editMembership(
                            testClient,
                            organizationId,
                            bob.user_id,
                            email,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: getAdminAuthToken() },
                            undefined,
                            '',
                            ''
                        )
                        let newUser = gqlresult.user
                        expect(newUser).to.exist
                        expect(newUser.email).to.equal(email)
                        expect(newUser.user_id).to.eq(bob.user_id)
                        expect(newUser.alternate_email).to.be.null
                        expect(newUser.alternate_phone).to.be.null
                    })
                })

                it('edits user and lets them change email', async () => {
                    let email = 'bob@nowhere.com'
                    let phone = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let bob = {
                        given_name: given,
                        family_name: family,
                        email: email,
                    } as User
                    bob = await createUserAndValidate(testClient, bob)
                    const newEmail = 'bob@somewhere.com'
                    let gqlresult = await editMembership(
                        testClient,
                        organizationId,
                        bob.user_id,
                        newEmail,
                        phone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult.user
                    let membership = gqlresult.membership
                    let schoolmemberships = gqlresult.schoolMemberships
                    expect(newUser).to.exist
                    expect(newUser.email).to.equal(newEmail)
                    expect(newUser.user_id).to.eq(bob.user_id)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })

                it('edits user and lets them change the phone', async () => {
                    let email = undefined
                    let phone = '+44207344141'
                    let given = 'Bob'
                    let family = 'Smith'
                    let bob = {
                        given_name: given,
                        family_name: family,
                        phone: phone,
                    } as User
                    bob = await createUserAndValidate(testClient, bob)
                    const newPhone = '+44207344142'
                    let gqlresult = await editMembership(
                        testClient,
                        organizationId,
                        bob.user_id,
                        email,
                        newPhone,
                        given,
                        family,
                        undefined,
                        'Buster',
                        'Male',
                        undefined,
                        new Array(roleId),
                        Array(schoolId),
                        new Array(roleId),
                        { authorization: getAdminAuthToken() }
                    )
                    let newUser = gqlresult.user
                    let membership = gqlresult.membership
                    let schoolmemberships = gqlresult.schoolMemberships
                    expect(newUser).to.exist
                    expect(newUser.phone).to.equal(newPhone)
                    expect(newUser.user_id).to.eq(bob.user_id)

                    expect(schoolmemberships).to.exist
                    expect(schoolmemberships.length).to.equal(1)
                    expect(schoolmemberships[0].user_id).to.equal(
                        newUser.user_id
                    )
                    expect(schoolmemberships[0].school_id).to.equal(schoolId)

                    expect(membership).to.exist
                    expect(membership.organization_id).to.equal(organizationId)
                    expect(membership.user_id).to.equal(newUser.user_id)
                })

                context('and the organization is marked as inactive', () => {
                    beforeEach(async () => {
                        await deleteOrganization(
                            testClient,
                            organization.organization_id,
                            { authorization: getAdminAuthToken() }
                        )
                    })

                    it('fails to edit membership on the organization', async () => {
                        let email = undefined
                        let phone = '+44207344141'
                        let given = 'Bob'
                        let family = 'Smith'
                        let bob = {
                            given_name: given,
                            family_name: family,
                            phone: phone,
                        } as User
                        bob = await createUserAndValidate(testClient, bob)
                        let gqlresult = await editMembership(
                            testClient,
                            organizationId,
                            undefined,
                            email,
                            phone,
                            given,
                            family,
                            undefined,
                            'Buster',
                            'Male',
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: getAdminAuthToken() }
                        )
                        expect(gqlresult).to.be.null
                    })
                })
            }
        )

        context(
            'The user_id is in a cookie and not the token of a user with the correct permissions',
            async () => {
                let userId: string
                let organizationId: string
                let schoolId: string
                let oldSchoolId: string
                let roleId: string
                let editorRoleId: string
                let otherUserId: string
                let otherUser: User
                let idLessToken: string

                beforeEach(async () => {
                    user = await createAdminUser(testClient)
                    userId = user.user_id
                    otherUser = await createNonAdminUser(testClient)
                    otherUserId = otherUser.user_id
                    organization = await createOrganizationAndValidate(
                        testClient,
                        user.user_id
                    )
                    organizationId = organization.organization_id
                    role = await createRole(
                        testClient,
                        organization.organization_id,
                        'student'
                    )
                    roleId = role.role_id
                    const editorRole = await createRole(
                        testClient,
                        organization.organization_id,
                        'editor'
                    )
                    editorRoleId = editorRole.role_id
                    await addUserToOrganizationAndValidate(
                        testClient,
                        otherUserId,
                        organizationId,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        userId,
                        organizationId,
                        roleId,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        editorRoleId,
                        PermissionName.edit_users_40330,
                        { authorization: getAdminAuthToken() }
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        otherUserId,
                        organizationId,
                        editorRoleId,
                        { authorization: getAdminAuthToken() }
                    )
                    oldSchoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 1',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    schoolId = (
                        await createSchool(
                            testClient,
                            organizationId,
                            'school 2',
                            undefined,
                            { authorization: getAdminAuthToken() }
                        )
                    ).school_id
                    await addUserToSchool(testClient, userId, oldSchoolId, {
                        authorization: getAdminAuthToken(),
                    })
                    const idLess = {
                        email: otherUser.email,
                        given_name: otherUser.given_name,
                        family_name: otherUser.family_name,
                        date_of_birth: otherUser.date_of_birth,
                    } as User
                    idLessToken = generateToken(userToPayload(idLess))
                })

                it('fails to edits user when no cookie provided', async () => {
                    let email = 'bob@nowhere.com'
                    let phone: string | undefined = undefined
                    let given = 'Bob'
                    let family = 'Smith'
                    let bob = {
                        given_name: given,
                        family_name: family,
                        email: email,
                    } as User
                    bob = await createUserAndValidate(testClient, bob)

                    const fn = () =>
                        editMembership(
                            testClient,
                            organizationId,
                            bob.user_id,
                            email,
                            phone,
                            given,
                            family,
                            undefined,
                            'Buster',
                            'Male',
                            undefined,
                            new Array(roleId),
                            Array(schoolId),
                            new Array(roleId),
                            { authorization: idLessToken }
                        )

                    expect(fn()).to.be.rejected
                })
            }
        )
        context('We create two users with the same email address', () => {
            let userId: string
            let organizationId: string
            let schoolId: string
            let roleId: string
            let otherUserId: string
            let createdUser1Id: string
            let createdUser2Id: string
            let email: string

            beforeEach(async () => {
                user = await createAdminUser(testClient)
                otherUserId = (await createNonAdminUser(testClient)).user_id
                userId = user.user_id
                let organization1 = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
                let organization1Id = organization1.organization_id
                role = await Role.findOneOrFail({
                    where: { role_name: 'Student' },
                })
                roleId = role.role_id
                let school1Id = (
                    await createSchool(
                        testClient,
                        organization1Id,
                        'school 1',
                        undefined,
                        { authorization: getAdminAuthToken() }
                    )
                ).school_id
                organization = await createOrganizationAndValidate(
                    testClient,
                    otherUserId,
                    'other Org',
                    'OTHERORG',
                    getNonAdminAuthToken()
                )
                organizationId = organization.organization_id
                schoolId = (
                    await createSchool(
                        testClient,
                        organizationId,
                        'school 2',
                        undefined,
                        { authorization: getNonAdminAuthToken() }
                    )
                ).school_id

                email = 'bob@nowhere.com'
                let phone = undefined
                let given = 'Bob'
                let family = 'Smith'
                let dateOfBirth = '02-1978'
                let gqlresult = await inviteUser(
                    testClient,
                    organization1Id,
                    email,
                    phone,
                    given,
                    family,
                    dateOfBirth,
                    'Bunter',
                    'Male',
                    undefined,
                    new Array(roleId),
                    Array(school1Id),
                    new Array(roleId),
                    { authorization: getAdminAuthToken() }
                )
                let createdUser = gqlresult?.user
                createdUser1Id = createdUser.user_id
                gqlresult = await inviteUser(
                    testClient,
                    organization1Id,
                    email,
                    phone,
                    given,
                    family,
                    dateOfBirth,
                    'Bunty',
                    'Female',
                    undefined,
                    new Array(roleId),
                    Array(school1Id),
                    new Array(roleId),
                    { authorization: getAdminAuthToken() }
                )
                createdUser = gqlresult?.user
                createdUser2Id = createdUser.user_id
            })
            it('joins the correct user to another organization', async () => {
                let gqlresult = await editMembership(
                    testClient,
                    organizationId,
                    createdUser2Id,
                    email,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    new Array(roleId),
                    Array(schoolId),
                    new Array(roleId),
                    { authorization: getAdminAuthToken() }
                )
                let newUser = gqlresult.user
                expect(newUser.user_id).to.eq(createdUser2Id)
                expect(newUser.username).to.eq('Bunty')
                expect(newUser.user_id).to.not.eq(createdUser1Id)
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
                const fn = () =>
                    deleteOrganization(
                        testClient,
                        organization.organization_id,
                        { authorization: undefined }
                    )
                expect(fn()).to.be.rejected
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
                        const fn = () =>
                            deleteOrganization(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                        expect(fn()).to.be.rejected
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
                    const fn = () =>
                        createOrUpdateAgeRanges(
                            testClient,
                            organization.organization_id,
                            [ageRangeInfo(ageRange)],
                            { authorization: undefined }
                        )

                    expect(fn()).to.be.rejected
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
                'and it tries to upate existing non system age ranges',
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
                        const fn = () =>
                            createOrUpdateAgeRanges(
                                testClient,
                                organization.organization_id,
                                [newAgeRange],
                                { authorization: undefined }
                            )

                        expect(fn()).to.be.rejected
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
                            const fn = () =>
                                createOrUpdateAgeRanges(
                                    testClient,
                                    organization.organization_id,
                                    [ageRangeInfo(ageRange)],
                                    { authorization: getNonAdminAuthToken() }
                                )

                            expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system age ranges',
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
                                const fn = () =>
                                    createOrUpdateAgeRanges(
                                        testClient,
                                        organization.organization_id,
                                        [newAgeRange],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system age ranges',
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
                                expect(
                                    dbAgeRanges.map(ageRangeInfo)
                                ).to.deep.eq([newAgeRange].map(ageRangeInfo))
                            })
                        }
                    )

                    context(
                        'and it tries to upate existing system age ranges',
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
                                const fn = () =>
                                    createOrUpdateAgeRanges(
                                        testClient,
                                        organization.organization_id,
                                        [newAgeRange],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system age ranges',
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
                        'and it tries to upate existing system age ranges',
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
                const fn = () =>
                    listAgeRanges(testClient, organization.organization_id, {
                        authorization: undefined,
                    })

                expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listAgeRanges(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
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

                    const fn = () =>
                        createOrUpdateGrades(
                            testClient,
                            organization.organization_id,
                            [gradeDetails],
                            { authorization: undefined }
                        )

                    expect(fn()).to.be.rejected
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

            context('and it tries to upate existing non system grades', () => {
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
                    const fn = () =>
                        createOrUpdateGrades(
                            testClient,
                            organization.organization_id,
                            [newGrade],
                            { authorization: undefined }
                        )

                    expect(fn()).to.be.rejected
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

                            const fn = () =>
                                createOrUpdateGrades(
                                    testClient,
                                    organization.organization_id,
                                    [gradeDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )

                            expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system grades',
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
                                const fn = () =>
                                    createOrUpdateGrades(
                                        testClient,
                                        organization.organization_id,
                                        [newGrade],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system grades',
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
                        'and it tries to upate existing system age ranges',
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
                                const fn = () =>
                                    createOrUpdateGrades(
                                        testClient,
                                        organization.organization_id,
                                        [newGrade],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system grades',
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
                        'and it tries to upate existing system age ranges',
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
                const fn = () =>
                    listGrades(testClient, organization.organization_id, {
                        authorization: undefined,
                    })

                expect(fn()).to.be.rejected
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
                    const fn = () =>
                        listGrades(testClient, organization.organization_id, {
                            authorization: getNonAdminAuthToken(),
                        })

                    expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listGrades(
                                testClient,
                                organization.organization_id,
                                {
                                    authorization: getNonAdminAuthToken(),
                                }
                            )

                        expect(fn()).to.be.rejected
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
                    const fn = () =>
                        createOrUpdateSubcategories(
                            testClient,
                            organization.organization_id,
                            [subcategoryInfo(subcategory)],
                            { authorization: undefined }
                        )

                    expect(fn()).to.be.rejected
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
                'and it tries to upate existing non system subcategories',
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
                        const fn = () =>
                            createOrUpdateSubcategories(
                                testClient,
                                organization.organization_id,
                                [subcategoryInfo(newSubcategory)],
                                { authorization: undefined }
                            )

                        expect(fn()).to.be.rejected
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
                            const fn = () =>
                                createOrUpdateSubcategories(
                                    testClient,
                                    organization.organization_id,
                                    [subcategoryInfo(subcategory)],
                                    { authorization: getNonAdminAuthToken() }
                                )

                            expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system subcategories',
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
                                const fn = () =>
                                    createOrUpdateSubcategories(
                                        testClient,
                                        organization.organization_id,
                                        [newSubcategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system subcategories',
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
                                ).to.deep.eq(
                                    [newSubcategory].map(subcategoryInfo)
                                )
                            })
                        }
                    )

                    context(
                        'and it tries to upate existing system subcategories',
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
                                const fn = () =>
                                    createOrUpdateSubcategories(
                                        testClient,
                                        organization.organization_id,
                                        [newSubcategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system subcategories',
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
                        'and it tries to upate existing system subcategories',
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
                const fn = () =>
                    listSubcategories(
                        testClient,
                        organization.organization_id,
                        { authorization: undefined }
                    )

                expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listSubcategories(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listSubcategories(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
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
                    const fn = () =>
                        createOrUpdateCategories(
                            testClient,
                            organization.organization_id,
                            [categoryDetails],
                            { authorization: undefined }
                        )

                    expect(fn()).to.be.rejected
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
                'and it tries to upate existing non system categories',
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
                        const fn = () =>
                            createOrUpdateCategories(
                                testClient,
                                organization.organization_id,
                                [categoryInfo(newCategory)],
                                { authorization: undefined }
                            )

                        expect(fn()).to.be.rejected
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
                            const fn = () =>
                                createOrUpdateCategories(
                                    testClient,
                                    organization.organization_id,
                                    [categoryDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )

                            expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system categories',
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
                                const fn = () =>
                                    createOrUpdateCategories(
                                        testClient,
                                        organization.organization_id,
                                        [newCategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system categories',
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
                                    { authorization: getNonAdminAuthToken() }
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
                                let newCategoryDetails = {
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

                    context(
                        'and it tries to upate existing system categories',
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
                                const fn = () =>
                                    createOrUpdateCategories(
                                        testClient,
                                        organization.organization_id,
                                        [newCategory],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system categories',
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
                        'and it tries to upate existing system categories',
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
                const fn = () =>
                    listCategories(testClient, organization.organization_id, {
                        authorization: undefined,
                    })

                expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listCategories(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
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
                    const fn = () =>
                        createOrUpdateSubjects(
                            testClient,
                            organization.organization_id,
                            [subjectDetails],
                            { authorization: undefined }
                        )

                    expect(fn()).to.be.rejected
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
                'and it tries to upate existing non system categories',
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
                        const fn = () =>
                            createOrUpdateSubjects(
                                testClient,
                                organization.organization_id,
                                [subjectInfo(newSubject)],
                                { authorization: undefined }
                            )

                        expect(fn()).to.be.rejected
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
                            const fn = () =>
                                createOrUpdateSubjects(
                                    testClient,
                                    organization.organization_id,
                                    [subjectDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )

                            expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system categories',
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
                                const fn = () =>
                                    createOrUpdateSubjects(
                                        testClient,
                                        organization.organization_id,
                                        [newSubject],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system categories',
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
                                let newSubjectDetails = {
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

                    context(
                        'and it tries to upate existing system categories',
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
                                const fn = () =>
                                    createOrUpdateSubjects(
                                        testClient,
                                        organization.organization_id,
                                        [newSubject],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system categories',
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
                        'and it tries to upate existing system categories',
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
                const fn = () =>
                    listSubjects(testClient, organization.organization_id, {
                        authorization: undefined,
                    })

                expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listSubjects(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
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
                    const fn = () =>
                        createOrUpdatePrograms(
                            testClient,
                            organization.organization_id,
                            [programDetails],
                            { authorization: undefined }
                        )

                    expect(fn()).to.be.rejected
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
                'and it tries to upate existing non system programs',
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
                        const fn = () =>
                            createOrUpdatePrograms(
                                testClient,
                                organization.organization_id,
                                [programInfo(newProgram)],
                                { authorization: undefined }
                            )

                        expect(fn()).to.be.rejected
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
                            const fn = () =>
                                createOrUpdatePrograms(
                                    testClient,
                                    organization.organization_id,
                                    [programDetails],
                                    { authorization: getNonAdminAuthToken() }
                                )

                            expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system programs',
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
                                const fn = () =>
                                    createOrUpdatePrograms(
                                        testClient,
                                        organization.organization_id,
                                        [newProgram],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system programs',
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
                                let newProgramDetails = {
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
                        'and it tries to upate existing system programs',
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

                            it('fails to update programs in the organization', async () => {
                                const fn = () =>
                                    createOrUpdatePrograms(
                                        testClient,
                                        organization.organization_id,
                                        [newProgram],
                                        {
                                            authorization: getNonAdminAuthToken(),
                                        }
                                    )

                                expect(fn()).to.be.rejected
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
                        'and it tries to upate existing non system programs',
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
                        'and it tries to upate existing system programs',
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
                const fn = () =>
                    listPrograms(testClient, organization.organization_id, {
                        authorization: undefined,
                    })

                expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listPrograms(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
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
                        const fn = () =>
                            listPrograms(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
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
        let organization: Organization
        let class1: Class
        let class2: Class
        let class1Id: string
        let class2Id: string
        let organizationId: string
        let school1: School
        let school2: School
        let school1Id: string
        let school2Id: string
        let systemRoles: any

        beforeEach(async () => {
            systemRoles = await getSystemRoleIds()
            const orgOwner = await createAdminUser(testClient)
            user = await createNonAdminUser(testClient)
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
            class1Id = class1.class_id

            class2 = await createClass(
                testClient,
                organization.organization_id,
                'class2',
                'CLASS2',
                { authorization: getAdminAuthToken() }
            )
            class2Id = class2.class_id

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

            await addSchoolToClass(testClient, class1Id, school1Id, {
                authorization: getAdminAuthToken(),
            })

            await addSchoolToClass(testClient, class2Id, school2Id, {
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
            it('fails to list classes in the organization', async () => {
                const fn = () =>
                    listClasses(testClient, organization.organization_id, {
                        authorization: undefined,
                    })

                expect(fn()).to.be.rejected
                const dbClasses = await Class.find({
                    where: {
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    },
                })
                expect(dbClasses.length).to.equal(2)
            })
        })

        context('when authenticated', () => {
            context(
                'and the user does not have view classes permissions',
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

                    it('fails to list Classes in the organization', async () => {
                        const fn = () =>
                            listClasses(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                        expect(fn()).to.be.rejected
                        const dbClasses = await Class.find({
                            where: {
                                organization: {
                                    organization_id:
                                        organization.organization_id,
                                },
                            },
                        })
                        expect(dbClasses.length).to.equal(2)
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
                        schoolAdminRoleId
                    )
                })

                it('lists the Classes in the school', async () => {
                    const gqlClasses = await listClasses(
                        testClient,
                        organization.organization_id,
                        { authorization: getNonAdminAuthToken() }
                    )
                    expect(gqlClasses.length).to.equal(1)
                    expect(gqlClasses[0].class_id).to.equal(class1Id)
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
                                orgAdminRoleId
                            )
                        })

                        it('lists all the classes in the organization', async () => {
                            const gqlprograms = await listPrograms(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )

                            const gqlClasses = await listClasses(
                                testClient,
                                organization.organization_id,
                                { authorization: getNonAdminAuthToken() }
                            )
                            expect(gqlClasses.length).to.equal(2)
                        })
                    }
                )
            })
        })
    })
})
