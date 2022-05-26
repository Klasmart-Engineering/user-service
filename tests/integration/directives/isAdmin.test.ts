import { expect, use } from 'chai'
import {
    Brackets,
    createQueryBuilder,
    getConnection,
    getRepository,
    SelectQueryBuilder,
} from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { TestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import {
    generateToken,
    getAdminAuthToken,
    getNonAdminAuthToken,
} from '../../utils/testConfig'
import {
    ageRangesConnection,
    categoriesConnection,
    classesConnection,
    getAllOrganizations,
    gradesConnection,
    permissionsConnection,
    schoolsConnection,
    subcategoriesConnection,
    subjectsConnection,
    userConnection,
} from '../../utils/operations/modelOps'
import {
    createOrganizationAndValidate,
    addOrganizationToUserAndValidate,
    addSchoolToUser,
    userToPayload,
} from '../../utils/operations/userOps'
import { Model } from '../../../src/model'
import { User } from '../../../src/entities/user'
import { Organization } from '../../../src/entities/organization'
import chaiAsPromised from 'chai-as-promised'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import { grantPermission } from '../../utils/operations/roleOps'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'
import {
    createOrganization,
    createOrganizations,
} from '../../factories/organization.factory'
import { createUser, createUsers } from '../../factories/user.factory'
import { createClass, createClasses } from '../../factories/class.factory'
import { Class } from '../../../src/entities/class'
import { pick } from 'lodash'
import {
    createOrganizationMembership,
    createOrganizationMemberships,
} from '../../factories/organizationMembership.factory'
import { ClassConnectionNode } from '../../../src/types/graphQL/class'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import {
    createSchoolMembership,
    createSchoolMemberships,
} from '../../factories/schoolMembership.factory'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { Permission } from '../../../src/entities/permission'
import {
    createEntityScope,
    IEntityString,
    nonAdminOrganizationScope,
    nonAdminSchoolScope,
    nonAdminUserScope,
} from '../../../src/directives/isAdmin'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { Subcategory } from '../../../src/entities/subcategory'
import { createSubcategory } from '../../factories/subcategory.factory'
import GradesInitializer from '../../../src/initializers/grades'
import SubjectsInitializer from '../../../src/initializers/subjects'
import { Grade } from '../../../src/entities/grade'
import { createGrade } from '../../factories/grade.factory'
import { AgeRange } from '../../../src/entities/ageRange'
import { createAgeRange } from '../../factories/ageRange.factory'
import { Category } from '../../../src/entities/category'
import { createCategory } from '../../factories/category.factory'
import { Subject } from '../../../src/entities/subject'
import { createSubject } from '../../factories/subject.factory'
import { IPaginatedResponse } from '../../../src/utils/pagination/paginate'
import { SubjectConnectionNode } from '../../../src/types/graphQL/subject'
import { Context } from '../../../src/main'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { TokenPayload } from '../../../src/token'
import { classesTeachingConnection } from '../../../src/schemas/user'
import { mapUserToUserConnectionNode } from '../../../src/pagination/usersConnection'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('isAdmin', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    context('performance', () => {
        let user: User
        // this setup is design to trigger all possible queries in isAdmin directives
        const maxQueryCountPerEntity: Record<IEntityString, number> = {
            organization: 1,
            user: 4,
            role: 1,
            class: 2,
            ageRange: 0,
            grade: 0,
            category: 0,
            subcategory: 0,
            subject: 0,
            program: 0,
            school: 2,
            permission: 1,
            schoolMembership: 5,
            organizationMembership: 4,
            academicTerm: 0,
        }

        beforeEach(async () => {
            // assign a user to an org for each system role
            // along with a class & school
            user = await createUser().save()
            const roles = await Role.findBy({ system_role: true })
            const orgs = await Organization.save(
                createOrganizations(roles.length)
            )
            for (let i = 0; i < orgs.length; i++) {
                /* eslint-disable no-await-in-loop */
                const school = await createSchool(orgs[i]).save()
                await createClass([school], orgs[i], {
                    teachers: [user],
                }).save()
                await createOrganizationMembership({
                    user,
                    organization: orgs[i],
                    roles: [roles[i]],
                }).save()
                await createSchoolMembership({
                    user,
                    school,
                }).save()
                /* eslint-enable no-await-in-loop */
            }
        })
        // isAdmin directives MUST cache queries as they are called for every
        // field in the _response_, and will otherwise repeat those queries
        it('does not repeat DB queries if called multiple times', async () => {
            for (const [entity, maxQueryCount] of Object.entries(
                maxQueryCountPerEntity
            )) {
                /* eslint-disable no-await-in-loop */
                const permissions = new UserPermissions({
                    id: user.user_id,
                    email: user.email,
                })

                connection.logger.reset()
                await createEntityScope({
                    permissions,
                    entity: entity as IEntityString,
                })
                expect(connection.logger.count).to.be.eq(maxQueryCount)

                connection.logger.reset()
                await createEntityScope({
                    permissions,
                    entity: entity as IEntityString,
                })
                expect(connection.logger.count).to.eq(0)
                /* eslint-enable no-await-in-loop */
            }
        })
    })

    describe('organizations', () => {
        let user: User
        let organization: Organization

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            organization = await createOrganizationAndValidate(
                testClient,
                user.user_id
            )
        })

        context('when user is not logged in', () => {
            it('fails authentication', async () => {
                const gqlResult = getAllOrganizations(testClient, {
                    authorization: undefined,
                })

                await expect(gqlResult).to.be.rejectedWith(
                    Error,
                    'User is required for authorization'
                )
            })
        })

        context('when user is logged in', () => {
            const orgInfo = (org: Organization) => {
                return org.organization_id
            }

            let noMember: User
            let otherOrganization: Organization

            beforeEach(async () => {
                const otherUser = await createNonAdminUser(testClient)
                noMember = await createUser().save()
                otherOrganization = await createOrganizationAndValidate(
                    testClient,
                    otherUser.user_id,
                    "Billy's Org"
                )
            })

            context('and the user is an admin', () => {
                it('returns all the organizations', async () => {
                    const gqlOrgs = await getAllOrganizations(testClient, {
                        authorization: getAdminAuthToken(),
                    })

                    expect(gqlOrgs.map(orgInfo)).to.deep.equalInAnyOrder([
                        organization.organization_id,
                        otherOrganization.organization_id,
                    ])
                })
            })

            context('and the user is not an admin', () => {
                it('returns only the organizations it belongs to', async () => {
                    const gqlOrgs = await getAllOrganizations(testClient, {
                        authorization: getNonAdminAuthToken(),
                    })

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([
                        otherOrganization.organization_id,
                    ])
                })
            })

            context('and the user does not belong to any organization', () => {
                it('has not access to any organization', async () => {
                    const gqlOrgs = await getAllOrganizations(testClient, {
                        authorization: generateToken(userToPayload(noMember)),
                    })

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([])
                })
            })
        })

        context('nonAdminOrganizationScope', async () => {
            let clientUser: User
            let clientUserOrg: Organization
            let otherUserOrg: Organization
            let bothUsersOrg: Organization
            let permissions: UserPermissions
            let memberships: Map<User, Organization[]>
            let otherUser: User
            let scope: SelectQueryBuilder<Organization>

            beforeEach(async () => {
                clientUser = await createUser().save()
                otherUser = await createUser().save()
                clientUserOrg = await createOrganization().save()
                otherUserOrg = await createOrganization().save()
                bothUsersOrg = await createOrganization().save()

                const role = await createRole(undefined, undefined, {
                    permissions: [
                        PermissionName.create_an_organization_account_1,
                    ],
                }).save()

                memberships = new Map([
                    [clientUser, [clientUserOrg, bothUsersOrg]],
                    [otherUser, [otherUserOrg, bothUsersOrg]],
                ])

                for (const [user, organizations] of memberships) {
                    for (const organization of organizations) {
                        await createOrganizationMembership({
                            user,
                            organization,
                            roles: [role],
                        }).save()
                    }
                }

                const token = { id: clientUser.user_id }
                permissions = new UserPermissions(token)

                scope = createQueryBuilder(Organization)
                await nonAdminOrganizationScope(
                    scope as SelectQueryBuilder<
                        Organization | OrganizationMembership
                    >,
                    permissions
                )
            })

            it('limits scope to a users organizations', async () => {
                const orgs = await scope.select('Organization').getMany()

                expect(
                    orgs.map((org) => org.organization_id)
                ).deep.equalInAnyOrder(
                    memberships
                        .get(clientUser)!
                        .map((org) => org.organization_id)
                )
            })

            // use case for this is organizationConnection child on usersConnection
            it('when filtering by another user, shows intersection of organizations both users belong to', async () => {
                scope.select('Organization')
                scope.innerJoin(
                    OrganizationMembership,
                    'OrganizationMembership',
                    'Organization.organization_id = OrganizationMembership.organizationOrganizationId'
                )

                // if nonAdminOrganizationScope joined to OrganizationMembership itself
                // then it would now be filtering on 2 mutually exclusive conditions
                scope.andWhere('OrganizationMembership.userUserId = :userId', {
                    userId: otherUser.user_id,
                })

                const orgs = await scope.getMany()

                expect(
                    orgs.map((org) => org.organization_id)
                ).deep.equalInAnyOrder([bothUsersOrg.organization_id])
            })
        })
    })

    describe('users', async () => {
        const direction = 'FORWARD'
        let usersList: User[] = []
        let roleList: Role[] = []
        let organizations: Organization[] = []
        let schools: School[] = []
        let superAdmin: User

        beforeEach(async () => {
            usersList = []
            roleList = []
            organizations = []
            schools = []

            superAdmin = await createAdminUser(testClient)

            // create two orgs and two schools
            for (let i = 0; i < 2; i++) {
                const org = createOrganization(superAdmin)
                await connection.manager.save(org)
                organizations.push(org)
                const role = createRole('role ' + i, org)
                await connection.manager.save(role)
                roleList.push(role)
                const school = createSchool(org)
                await connection.manager.save(school)
                schools.push(school)
            }
            // create 10 users
            for (let i = 0; i < 10; i++) {
                usersList.push(createUser())
            }
            //sort users by userId
            await connection.manager.save(usersList)
            // add organizations and schools to users

            for (const user of usersList) {
                for (let i = 0; i < 2; i++) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        organizations[i].organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organizations[i].organization_id,
                        roleList[i].role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        user.user_id,
                        schools[i].school_id,
                        { authorization: getAdminAuthToken() }
                    )
                }
            }
        })

        context('super admin', () => {
            it('can view all users', async () => {
                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 30 },
                    { authorization: getAdminAuthToken() }
                )

                expect(usersConnection.totalCount).to.eq(11)
                expect(usersConnection.edges.length).to.eq(11)
            })
        })
        context('non admin', () => {
            context('nonAdminUserScope', () => {
                let scope: SelectQueryBuilder<User>
                let token: TokenPayload
                let user: User
                let userPermissions: UserPermissions

                beforeEach(async () => {
                    scope = getRepository(User).createQueryBuilder()
                    user = await createUser().save()
                    token = userToPayload(user, true)
                    userPermissions = new UserPermissions(token)
                })

                context('when username is set', () => {
                    context(
                        'when there is more then one user with the same username',
                        () => {
                            beforeEach(async () => {
                                const userWithSameName = await createUser()
                                userWithSameName.username = user.username
                                await userWithSameName.save()
                            })

                            it('returns only the user with matching user_id', async () => {
                                await nonAdminUserScope(scope, userPermissions)
                                const users = await scope.getMany()
                                expect(users).to.have.length(1)
                                expect(users[0].user_id).to.eq(user.user_id)
                            })
                        }
                    )

                    it('does not return users with the same email or phone', async () => {
                        await createUser({
                            email: user.email,
                            phone: user.phone,
                        }).save()
                        await nonAdminUserScope(scope, userPermissions)
                        const users = await scope.getMany()
                        expect(users).to.have.length(1)
                        expect(users[0].user_id).to.eq(user.user_id)
                    })
                })

                it('errors if no user_id is set', async () => {
                    token.id = undefined
                    userPermissions = new UserPermissions(token)

                    await expect(
                        nonAdminUserScope(scope, userPermissions)
                    ).to.eventually.rejectedWith(
                        'User is required for authorization'
                    )
                })

                context(
                    'permission precedence performance optimization',
                    () => {
                        let organization: Organization
                        beforeEach(async () => {
                            organization = await createOrganization().save()
                        })
                        it("doesn't query view_my_school_users_40111 if view_users_40110 is granted in the same org", async () => {
                            const role = await createRole(
                                'role',
                                organization,
                                {
                                    permissions: [
                                        // view_users_40110 gives full access
                                        PermissionName.view_users_40110,
                                        // so don't need to check this
                                        PermissionName.view_my_school_users_40111,
                                    ],
                                }
                            ).save()
                            await createOrganizationMembership({
                                user,
                                organization,
                                roles: [role],
                            }).save()

                            await nonAdminUserScope(scope, userPermissions)
                            const query = scope.getQuery()
                            expect(query).to.include('organization_membership')
                            expect(query).to.not.include('school')
                        })
                        it('will always query class users if granted the permissions AND teacher of at least one class', async () => {
                            // classes may not have a school, and therefore not a subset of view_my_school_users_40111
                            const role = await createRole(
                                'role',
                                organization,
                                {
                                    permissions: [
                                        PermissionName.view_my_school_users_40111,
                                        PermissionName.view_my_class_users_40112,
                                    ],
                                }
                            ).save()
                            await createOrganizationMembership({
                                user,
                                organization,
                                roles: [role],
                            }).save()

                            const school = await createSchool(
                                organization
                            ).save()
                            await createSchoolMembership({
                                user,
                                school,
                            }).save()

                            const class_ = await createClass(
                                undefined,
                                undefined,
                                {
                                    teachers: [user],
                                }
                            ).save()

                            await nonAdminUserScope(scope, userPermissions)
                            const query = scope.getQuery()
                            expect(query).to.not.include(
                                'organization_membership'
                            )
                            expect(query).to.include('school')
                            expect(query).to.include('class')
                        })
                        it('queries both view_users_40110 & view_my_school_users_40111 if they are from different orgs', async () => {
                            const org1Role = await createRole(
                                'role',
                                organization,
                                {
                                    permissions: [
                                        PermissionName.view_users_40110,
                                    ],
                                }
                            ).save()

                            const org2 = await createOrganization().save()
                            const org2Role = await createRole(
                                'role',
                                organization,
                                {
                                    permissions: [
                                        PermissionName.view_my_school_users_40111,
                                    ],
                                }
                            ).save()
                            await createOrganizationMembership({
                                user,
                                organization,
                                roles: [org1Role],
                            }).save()
                            await createOrganizationMembership({
                                user,
                                organization: org2,
                                roles: [org2Role],
                            }).save()
                            const school = await createSchool(org2).save()
                            await createSchoolMembership({
                                user,
                                school,
                            }).save()

                            await nonAdminUserScope(scope, userPermissions)
                            const query = scope.getQuery()
                            expect(query).to.include('organization_membership')
                            expect(query).to.include('school')
                            expect(query).to.not.include('class')
                        })
                    }
                )
            })

            it('no permission needed to view my users', async () => {
                const user = await createNonAdminUser(testClient)
                const user2 = createUser()
                user2.email = user.email
                await connection.manager.save([user2])

                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    getAdminAuthToken()
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    roleList[0].role_id,
                    { authorization: getAdminAuthToken() }
                )

                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 10 },
                    { authorization: getNonAdminAuthToken() }
                )

                expect(usersConnection.totalCount).to.eq(2)
                expect(usersConnection.edges.length).to.eq(2)
            })

            it('requires view_users_40110 permission to view org users', async () => {
                const user = await createNonAdminUser(testClient)
                const token = getNonAdminAuthToken()
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    getAdminAuthToken()
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    roleList[0].role_id,
                    { authorization: getAdminAuthToken() }
                )

                let usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                // can view my user only`
                expect(usersConnection.totalCount).to.eq(1)
                expect(usersConnection.edges.length).to.eq(1)

                await grantPermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_users_40110,
                    { authorization: getAdminAuthToken() }
                )

                usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                expect(usersConnection.totalCount).to.eq(11)
            })

            context('with view_my_class_users_40112', () => {
                let token: string
                let user: User

                const makeClass = async (teachers: User[], students: User[]) =>
                    createClass([schools[0]], organizations[0], {
                        teachers,
                        students,
                    }).save()

                beforeEach(async () => {
                    user = await createNonAdminUser(testClient)
                    token = getNonAdminAuthToken()
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        organizations[0].organization_id,
                        getAdminAuthToken()
                    )

                    await addRoleToOrganizationMembership(
                        testClient,
                        user.user_id,
                        organizations[0].organization_id,
                        roleList[0].role_id,
                        { authorization: getAdminAuthToken() }
                    )

                    await grantPermission(
                        testClient,
                        roleList[0].role_id,
                        PermissionName.view_my_class_users_40112,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('can see themselves in a class', async () => {
                    const teacher = user
                    await makeClass([teacher], [])

                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: token }
                    )

                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).to.have.same.members([teacher.user_id])
                })

                it('can see other teachers in a class', async () => {
                    const teachers = [user, usersList[0]]
                    await makeClass(teachers, [])

                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: token }
                    )

                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).to.have.same.members(teachers.map((t) => t.user_id))
                })

                it('can see students from multiple classes', async () => {
                    const teacher = user
                    const student1 = usersList[0]
                    await makeClass([teacher], [student1])
                    const student2 = usersList[1]
                    await makeClass([teacher], [student2])

                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: token }
                    )

                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).to.have.same.members([
                        teacher.user_id,
                        student1.user_id,
                        student2.user_id,
                    ])
                })

                it('students in multiple classes are not duplicated', async () => {
                    const teacher = user
                    const student = usersList[0]

                    await makeClass([teacher], [student])
                    await makeClass([teacher], [student])

                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: token }
                    )

                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).to.have.same.members([teacher.user_id, student.user_id])
                })

                it('teachers in multiple classes are not duplicated', async () => {
                    const teacher = user
                    await makeClass([teacher], [])
                    await makeClass([teacher], [])

                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: token }
                    )

                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).to.have.same.members([teacher.user_id])
                })

                it("can't see students from classes they don't teach", async () => {
                    const student = usersList[0]
                    await makeClass([], [student])

                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: token }
                    )
                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).to.have.same.members([user.user_id])
                })
            })

            context('with view_my_admin_users_40114', () => {
                let user: User
                let schoolAdminSameSchool: User
                let schoolAdminRole: Role

                beforeEach(async () => {
                    //grant view_my_admin_users_40114 permission to users[0]
                    user = usersList[0]
                    await grantPermission(
                        testClient,
                        roleList[0].role_id,
                        PermissionName.view_my_admin_users_40114,
                        { authorization: getAdminAuthToken() }
                    )

                    //create school admin of the same school
                    schoolAdminSameSchool = await createUser().save()
                    schoolAdminRole = await createRole(
                        'schoolAdmin',
                        organizations[0]
                    ).save()
                    await addOrganizationToUserAndValidate(
                        testClient,
                        schoolAdminSameSchool.user_id,
                        organizations[0].organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        schoolAdminSameSchool.user_id,
                        organizations[0].organization_id,
                        schoolAdminRole.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        schoolAdminSameSchool.user_id,
                        schools[0].school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        schoolAdminRole.role_id,
                        PermissionName.view_my_school_users_40111,
                        { authorization: getAdminAuthToken() }
                    )
                })

                it('can see school admins from his school', async () => {
                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: generateToken(userToPayload(user)) }
                    )

                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).to.have.same.members([
                        user.user_id,
                        schoolAdminSameSchool.user_id,
                    ])
                })

                it('can not see school admins from another school', async () => {
                    //create school admin of the same school
                    const schoolAdminAnotherSchool = await createUser().save()
                    const anotherRole = await createRole(
                        'anotherRole',
                        organizations[0]
                    ).save()
                    await addOrganizationToUserAndValidate(
                        testClient,
                        schoolAdminAnotherSchool.user_id,
                        organizations[0].organization_id,
                        getAdminAuthToken()
                    )
                    await addRoleToOrganizationMembership(
                        testClient,
                        schoolAdminAnotherSchool.user_id,
                        organizations[0].organization_id,
                        anotherRole.role_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await addSchoolToUser(
                        testClient,
                        schoolAdminAnotherSchool.user_id,
                        schools[0].school_id,
                        { authorization: getAdminAuthToken() }
                    )
                    await grantPermission(
                        testClient,
                        anotherRole.role_id,
                        PermissionName.view_my_school_users_40111,
                        { authorization: getAdminAuthToken() }
                    )

                    const usersConnection = await userConnection(
                        testClient,
                        direction,
                        { count: 30 },
                        { authorization: generateToken(userToPayload(user)) }
                    )

                    expect(
                        usersConnection.edges.map((edge) => edge.node.id)
                    ).not.to.have.same.members([
                        schoolAdminAnotherSchool.user_id,
                    ])
                })
            })

            it('requires view_my_school_users_40111 to view school users', async () => {
                const user = await createNonAdminUser(testClient)
                const token = getNonAdminAuthToken()
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    getAdminAuthToken()
                )
                await addSchoolToUser(
                    testClient,
                    user.user_id,
                    schools[0].school_id,
                    { authorization: getAdminAuthToken() }
                )

                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    roleList[0].role_id,
                    { authorization: getAdminAuthToken() }
                )

                let usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                // can view my user only
                expect(usersConnection.totalCount).to.eq(1)
                expect(usersConnection.edges.length).to.eq(1)

                await grantPermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_my_school_users_40111,
                    { authorization: getAdminAuthToken() }
                )

                usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 30 },
                    { authorization: token }
                )

                expect(usersConnection.totalCount).to.eq(11)
            })

            it('returns empty if view_my_school_users_40111 permission given but no school memberships', async () => {
                const user = await createNonAdminUser(testClient)
                const token = getNonAdminAuthToken()
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    getAdminAuthToken()
                )

                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    roleList[0].role_id,
                    { authorization: getAdminAuthToken() }
                )

                await grantPermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_my_school_users_40111,
                    { authorization: getAdminAuthToken() }
                )

                let usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 30 },
                    { authorization: token }
                )

                expect(usersConnection.totalCount).to.eq(1)
                expect(usersConnection.edges[0].node.schools).to.be.empty
            })

            it("doesn't show users from other orgs", async () => {
                const user = await createNonAdminUser(testClient)
                const token = getNonAdminAuthToken()
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    getAdminAuthToken()
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    roleList[0].role_id,
                    { authorization: getAdminAuthToken() }
                )

                await grantPermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_users_40110,
                    { authorization: getAdminAuthToken() }
                )

                // add a new user to a different org
                const newUser = createUser()

                await connection.manager.save([newUser])
                await addOrganizationToUserAndValidate(
                    testClient,
                    newUser.user_id,
                    organizations[1].organization_id,
                    getAdminAuthToken()
                )

                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                expect(usersConnection.totalCount).to.eq(11)
            })

            it("doesn't show users from other schools", async () => {
                const user = await createNonAdminUser(testClient)
                const token = getNonAdminAuthToken()
                await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    getAdminAuthToken()
                )
                await addSchoolToUser(
                    testClient,
                    user.user_id,
                    schools[0].school_id,
                    { authorization: getAdminAuthToken() }
                )

                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    organizations[0].organization_id,
                    roleList[0].role_id,
                    { authorization: getAdminAuthToken() }
                )

                await grantPermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_my_school_users_40111,
                    { authorization: getAdminAuthToken() }
                )

                // add a new user to a school in a different org
                const newUser = createUser()
                await connection.manager.save([newUser])
                await addSchoolToUser(
                    testClient,
                    newUser.user_id,
                    schools[1].school_id,
                    { authorization: getAdminAuthToken() }
                )

                // add the user to a different school in the same org
                const school = createSchool(organizations[0])
                await connection.manager.save(school)
                await addSchoolToUser(
                    testClient,
                    newUser.user_id,
                    school.school_id,
                    { authorization: getAdminAuthToken() }
                )

                // add another user to same org, without school
                const anotherUser = createUser()
                await connection.manager.save([anotherUser])
                await addOrganizationToUserAndValidate(
                    testClient,
                    anotherUser.user_id,
                    organizations[0].organization_id,
                    getAdminAuthToken()
                )

                const usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                expect(usersConnection.totalCount).to.eq(11)
            })

            context('multiple organizations', () => {
                let clientUser: User

                let org1: Organization
                let org2: Organization
                let org1Users: User[]
                let org2Users: User[]

                async function addUserToOrg(
                    user: User,
                    org: Organization,
                    permissions: PermissionName[]
                ) {
                    const role = await createRole('role', org, {
                        permissions,
                    }).save()
                    return await createOrganizationMembership({
                        user,
                        organization: org,
                        roles: [role],
                    }).save()
                }

                async function getUserIds() {
                    const scope = (await createEntityScope({
                        permissions: new UserPermissions(
                            userToPayload(clientUser)
                        ),
                        entity: 'user',
                    })) as SelectQueryBuilder<User>
                    const users = await scope.getMany()
                    return users.map((u) => u.user_id)
                }

                beforeEach(async () => {
                    clientUser = await createNonAdminUser(testClient)
                    org1 = await createOrganization().save()
                    org2 = await createOrganization().save()
                    // add some users to each org
                    org1Users = await User.save(createUsers(20))
                    org2Users = await User.save(createUsers(20))
                    await Promise.all([
                        ...org1Users.map((user) =>
                            createOrganizationMembership({
                                user,
                                organization: org1,
                            }).save()
                        ),
                        ...org2Users.map((user) =>
                            createOrganizationMembership({
                                user,
                                organization: org2,
                            }).save()
                        ),
                    ])

                    // create some schools in each org, and add some users
                    const org1Schools = await School.save([
                        createSchool(org1),
                        createSchool(org1),
                    ])
                    await Promise.all([
                        ...org1Users.slice(0, 5).map((user) =>
                            createSchoolMembership({
                                user,
                                school: org1Schools[0],
                            }).save()
                        ),
                        ...org1Users.slice(5, 10).map((user) =>
                            createSchoolMembership({
                                user,
                                school: org1Schools[1],
                            }).save()
                        ),
                    ])
                    const org2Schools = await School.save([
                        createSchool(org2),
                        createSchool(org2),
                    ])
                    await Promise.all([
                        ...org2Users.slice(0, 5).map((user) =>
                            createSchoolMembership({
                                user,
                                school: org2Schools[0],
                            }).save()
                        ),
                        ...org2Users.slice(5, 10).map((user) =>
                            createSchoolMembership({
                                user,
                                school: org2Schools[1],
                            }).save()
                        ),
                    ])

                    // create some classes in each org, and add some users
                    await Class.save([
                        createClass(
                            undefined,
                            org1,
                            {
                                students: org1Users.slice(0, 5),
                                teachers: org1Users.slice(5, 10),
                            },
                            'org 1 class 1'
                        ),
                        createClass(
                            undefined,
                            org1,
                            {
                                students: org1Users.slice(10, 15),
                                teachers: org1Users.slice(15, 20),
                            },
                            'org 1 class 2'
                        ),
                    ])
                    await Class.save([
                        createClass(
                            undefined,
                            org2,
                            {
                                students: org2Users.slice(0, 5),
                                teachers: org2Users.slice(5, 10),
                            },
                            'org 1 class 1'
                        ),
                        createClass(
                            undefined,
                            org2,
                            {
                                students: org2Users.slice(10, 15),
                                teachers: org2Users.slice(15, 20),
                            },
                            'org 1 class 2'
                        ),
                    ])
                })

                context('org admin in org1', () => {
                    beforeEach(async () => {
                        await addUserToOrg(clientUser, org1, [
                            PermissionName.view_users_40110,
                        ])
                    })
                    context('org admin in org2', () => {
                        beforeEach(async () => {
                            await addUserToOrg(clientUser, org2, [
                                PermissionName.view_users_40110,
                            ])
                        })
                        it('returns all users from both organizations', async () => {
                            const users = await getUserIds()
                            const expectedIds = org1Users
                                .map((user) => user.user_id)
                                .concat(org2Users.map((user) => user.user_id))
                                .concat([clientUser.user_id])
                            expect(users).to.have.same.members(expectedIds)
                        })
                    })
                    context('school admin in org2', () => {
                        let school: School
                        let schoolUsers: SchoolMembership[]
                        beforeEach(async () => {
                            await addUserToOrg(clientUser, org2, [
                                PermissionName.view_my_school_users_40111,
                            ])
                            school = (await org2.schools)![0]
                            schoolUsers = (await (await org2.schools)![0]
                                .memberships)!
                            await createSchoolMembership({
                                user: clientUser,
                                school,
                            }).save()
                        })
                        it('returns all users in org1, common school members in org2', async () => {
                            const users = await getUserIds()
                            const expectedIds = org1Users
                                .map((user) => user.user_id)
                                .concat(schoolUsers.map((m) => m.user_id))
                                .concat([clientUser.user_id])
                            expect(users).to.have.same.members(expectedIds)
                        })
                    })
                    context('class teacher in org2', () => {
                        let class_: Class
                        let classUsers: User[]
                        beforeEach(async () => {
                            await addUserToOrg(clientUser, org2, [
                                PermissionName.view_my_class_users_40112,
                            ])
                            class_ = (await org2.classes)![0]
                            const teachers = await class_.teachers!
                            class_.teachers = Promise.resolve([
                                ...teachers,
                                clientUser,
                            ])
                            await class_.save()
                            classUsers = (await class_.students!).concat(
                                await class_.teachers!
                            )
                        })
                        it('returns all users in org1, only students and teachers in org2', async () => {
                            const users = await getUserIds()
                            const expectedIds = org1Users
                                .map((user) => user.user_id)
                                .concat(classUsers.map((m) => m.user_id))
                            expect(users).to.have.same.members(expectedIds)
                        })
                    })
                    context('class student in org2', () => {
                        it('returns all users in org1, no users from org2', async () => {
                            const users = await getUserIds()
                            const expectedIds = org1Users
                                .map((user) => user.user_id)
                                .concat([clientUser.user_id])
                            expect(users).to.have.same.members(expectedIds)
                        })
                    })
                })

                context('school admin in org1', () => {
                    let org1School: School
                    let org1SchoolUsers: SchoolMembership[]
                    beforeEach(async () => {
                        await addUserToOrg(clientUser, org1, [
                            PermissionName.view_my_school_users_40111,
                        ])
                        org1School = (await org1.schools)![0]
                        org1SchoolUsers = (await org1School.memberships)!
                        await createSchoolMembership({
                            user: clientUser,
                            school: org1School,
                        }).save()
                    })
                    context('school admin in org2', () => {
                        let org2School: School
                        let org2SchoolUsers: SchoolMembership[]
                        beforeEach(async () => {
                            await addUserToOrg(clientUser, org2, [
                                PermissionName.view_my_school_users_40111,
                            ])
                            org2School = (await org2.schools)![0]
                            org2SchoolUsers = (await org2School.memberships)!
                            await createSchoolMembership({
                                user: clientUser,
                                school: org2School,
                            }).save()
                        })
                        it('can view school users in org1, school users in org2', async () => {
                            const users = await getUserIds()
                            const expectedIds = org1SchoolUsers
                                .map((m) => m.user_id)
                                .concat(org2SchoolUsers.map((m) => m.user_id))
                                .concat([clientUser.user_id])
                            expect(users).to.have.same.members(expectedIds)
                        })
                    })
                    context('school member in org2', () => {
                        let org2School: School
                        let org2SchoolUsers: SchoolMembership[]
                        beforeEach(async () => {
                            await addUserToOrg(clientUser, org2, [])
                            org2School = (await org2.schools)![0]
                            org2SchoolUsers = (await org2School.memberships)!
                            await createSchoolMembership({
                                user: clientUser,
                                school: org2School,
                            }).save()
                        })
                        it('can view school users in org1, none in org2 without permissions', async () => {
                            const users = await getUserIds()
                            const expectedIds = org1SchoolUsers
                                .map((m) => m.user_id)
                                .concat([clientUser.user_id])
                            expect(users).to.have.same.members(expectedIds)
                        })
                    })
                    context('class teacher in org2', () => {
                        let class_: Class
                        let classUsers: User[]
                        beforeEach(async () => {
                            await addUserToOrg(clientUser, org2, [
                                PermissionName.view_my_class_users_40112,
                            ])
                            class_ = (await org2.classes)![0]
                            const teachers = await class_.teachers!
                            class_.teachers = Promise.resolve([
                                ...teachers,
                                clientUser,
                            ])
                            await class_.save()
                            classUsers = (await class_.students!).concat(
                                await class_.teachers!
                            )
                        })
                        it('returns school users in org1, only students and teachers in org2', async () => {
                            const users = await getUserIds()
                            const expectedIds = org1SchoolUsers
                                .map((user) => user.user_id)
                                .concat(classUsers.map((m) => m.user_id))
                            expect(users).to.have.same.members(expectedIds)
                        })
                    })
                })
            })
        })
    })

    describe('classes', () => {
        type SimplifiedClassConnectionNode = Pick<
            ClassConnectionNode,
            'id' | 'name' | 'status'
        >
        let user: User
        let token: string
        let organizations: Organization[]
        let allClasses: SimplifiedClassConnectionNode[]
        let classesForOrganization: {
            [key: string]: SimplifiedClassConnectionNode[]
        }

        const queryVisibleClasses = async (token: string) => {
            const response = await classesConnection(
                testClient,
                'FORWARD',
                {},
                { authorization: token }
            )
            return response.edges
                .map((edge) => edge.node)
                .map((node) => pick(node, ['id', 'name', 'status']))
        }

        const grantPermissionFactory = async ({
            user,
            organization,
            permissions,
        }: {
            user: User
            organization: Organization
            permissions: PermissionName | PermissionName[]
        }) => {
            const role = await createRole(undefined, organization).save()
            await OrganizationMembership.createQueryBuilder()
                .relation('roles')
                .of({
                    user_id: user.user_id,
                    organization_id: organization.organization_id,
                })
                .add(role)
            await Role.createQueryBuilder()
                .relation('permissions')
                .of(role)
                .add(permissions)
        }

        beforeEach(async () => {
            organizations = await Organization.save([
                createOrganization(),
                createOrganization(),
                createOrganization(),
            ])
            allClasses = (
                await Class.save([
                    createClass([], organizations[0]),
                    createClass([], organizations[0]),
                    createClass([], organizations[1]),
                    createClass([], organizations[2]),
                ])
            ).map((cls) => {
                return {
                    id: cls.class_id,
                    name: cls.class_name,
                    status: cls.status,
                }
            })
            classesForOrganization = {
                [organizations[0].organization_id]: allClasses.slice(0, 2),
                [organizations[1].organization_id]: [allClasses[2]],
                [organizations[2].organization_id]: [allClasses[3]],
            }
        })

        context('admin', () => {
            beforeEach(async () => {
                user = await createAdminUser(testClient)
                token = generateToken(userToPayload(user))

                await createOrganizationMembership({
                    user,
                    organization: organizations[0],
                }).save()
            })

            it('allows access to all classes across all organizations, regardless of membership and permissions', async () => {
                const visibleClasses = await queryVisibleClasses(token)
                expect(visibleClasses).to.deep.equalInAnyOrder(allClasses)
            })
        })
        context('non-admin', () => {
            let school: School
            let classAssignedToSchool: SimplifiedClassConnectionNode
            let organizationWithMembership: Organization
            beforeEach(async () => {
                user = await createUser().save()
                token = generateToken(userToPayload(user))

                organizationWithMembership = organizations[0]

                await createOrganizationMembership({
                    user,
                    organization: organizationWithMembership,
                }).save()

                school = await createSchool(organizationWithMembership).save()

                classAssignedToSchool = allClasses[0]

                await createSchoolMembership({ user, school }).save()

                await School.createQueryBuilder()
                    .relation('classes')
                    .of(school)
                    .add(classAssignedToSchool.id)
            })

            context('view_classes_20114', () => {
                beforeEach(async () => {
                    await grantPermissionFactory({
                        user,
                        permissions: PermissionName.view_classes_20114,
                        organization: organizationWithMembership,
                    })
                })

                it('shows all classes in the Organization they belong to', async () => {
                    const visibleClasses = await queryVisibleClasses(token)
                    expect(visibleClasses).to.deep.equalInAnyOrder(
                        classesForOrganization[
                            organizationWithMembership.organization_id
                        ]
                    )
                })
            })

            context('view_school_classes_20117', () => {
                beforeEach(async () => {
                    await grantPermissionFactory({
                        user,
                        permissions: PermissionName.view_school_classes_20117,
                        organization: organizationWithMembership,
                    })
                })

                it('shows all classes in the Schools they belong to', async () => {
                    const visibleClasses = await queryVisibleClasses(token)
                    expect(visibleClasses).to.deep.equal([
                        classAssignedToSchool,
                    ])
                })
            })

            context('view_my_classes_20118', () => {
                beforeEach(async () => {
                    await grantPermissionFactory({
                        user,
                        permissions: PermissionName.view_my_classes_20118,
                        organization: organizationWithMembership,
                    })
                })

                context(
                    'shows only classes they are part of in an Organization',
                    () => {
                        it('as a student', async () => {
                            const myClass = await createClass(
                                [],
                                organizationWithMembership,
                                {
                                    students: [user],
                                }
                            ).save()
                            const visibleClasses = await queryVisibleClasses(
                                token
                            )
                            expect(visibleClasses).to.deep.equalInAnyOrder(
                                [myClass].map((cls) => {
                                    return {
                                        id: cls.class_id,
                                        name: cls.class_name,
                                        status: cls.status,
                                    }
                                })
                            )
                        })
                        it('as a teacher', async () => {
                            const myClass = await createClass(
                                [],
                                organizationWithMembership,
                                {
                                    teachers: [user],
                                }
                            ).save()
                            const visibleClasses = await queryVisibleClasses(
                                token
                            )
                            expect(visibleClasses).to.deep.equalInAnyOrder(
                                [myClass].map((cls) => {
                                    return {
                                        id: cls.class_id,
                                        name: cls.class_name,
                                        status: cls.status,
                                    }
                                })
                            )
                        })
                        it('as a student and a teacher', async () => {
                            const myClass = await createClass(
                                [],
                                organizationWithMembership,
                                {
                                    teachers: [user],
                                    students: [user],
                                }
                            ).save()
                            const visibleClasses = await queryVisibleClasses(
                                token
                            )
                            expect(visibleClasses).to.deep.equalInAnyOrder(
                                [myClass].map((cls) => {
                                    return {
                                        id: cls.class_id,
                                        name: cls.class_name,
                                        status: cls.status,
                                    }
                                })
                            )
                        })
                    }
                )
            })

            const clearPermissionFactory = async ({
                user,
                organization,
            }: {
                user: User
                organization: Organization
            }) => {
                const membership = await OrganizationMembership.findOneBy({
                    user_id: user.user_id,
                    organization_id: organization.organization_id,
                })
                membership!.roles = Promise.resolve([])
                await membership!.save()
            }

            context(
                'view_classes_20114 with other permissions in the same organization',
                () => {
                    it('gives the same results as just view_classes_20114', async () => {
                        const permissionCombinations = [
                            [],
                            [
                                PermissionName.view_school_classes_20117,
                                PermissionName.view_my_classes_20118,
                            ],
                            [PermissionName.view_my_classes_20118],
                            [PermissionName.view_school_classes_20117],
                        ]

                        await createClass([], organizationWithMembership, {
                            teachers: [user],
                        }).save()
                        const classesFoundForPermissionCombinations = await Promise.all(
                            permissionCombinations.map(async (pc) => {
                                await clearPermissionFactory({
                                    user,
                                    organization: organizationWithMembership,
                                })
                                await grantPermissionFactory({
                                    user,
                                    permissions: [
                                        ...pc,
                                        PermissionName.view_classes_20114,
                                    ],
                                    organization: organizationWithMembership,
                                })
                                return queryVisibleClasses(token)
                            })
                        )
                        for (const classesFoundForPermissionCombination of classesFoundForPermissionCombinations) {
                            expect(
                                classesFoundForPermissionCombination
                            ).to.deep.equalInAnyOrder(
                                classesFoundForPermissionCombinations[0]
                            )
                        }
                    })
                }
            )

            context(
                'view_school_classes_20117 and view_my_classes_20118 in the same organization',
                () => {
                    it('gives the same results as just view_school_classes_20117', async () => {
                        await createClass([], organizationWithMembership, {
                            teachers: [user],
                        }).save()

                        const permissionCombinations = [
                            [
                                PermissionName.view_school_classes_20117,
                                PermissionName.view_my_classes_20118,
                            ],
                            [PermissionName.view_school_classes_20117],
                        ]
                        const classesFoundForPermissionCombinations = await Promise.all(
                            permissionCombinations.map(async (pc) => {
                                await clearPermissionFactory({
                                    user,
                                    organization: organizationWithMembership,
                                })
                                await grantPermissionFactory({
                                    user,
                                    permissions: pc,
                                    organization: organizationWithMembership,
                                })
                                return queryVisibleClasses(token)
                            })
                        )
                        for (const classesFoundForPermissionCombination of classesFoundForPermissionCombinations) {
                            expect(
                                classesFoundForPermissionCombination
                            ).to.deep.equalInAnyOrder(
                                classesFoundForPermissionCombinations[0]
                            )
                        }
                    })
                }
            )

            context(
                'view_classes_20114, view_school_classes_20117 and view_my_classes_20118 in different organizations',
                () => {
                    let otherOrganizationWithMembership: Organization
                    let viewMyClassOrganizationWithMembership: Organization
                    beforeEach(async () => {
                        otherOrganizationWithMembership = organizations[1]
                        await createOrganizationMembership({
                            user,
                            organization: otherOrganizationWithMembership,
                        }).save()

                        viewMyClassOrganizationWithMembership = organizations[2]
                        await createOrganizationMembership({
                            user,
                            organization: viewMyClassOrganizationWithMembership,
                        }).save()

                        await grantPermissionFactory({
                            user,
                            permissions: [PermissionName.view_classes_20114],
                            organization: otherOrganizationWithMembership,
                        })

                        await grantPermissionFactory({
                            user,
                            permissions: [
                                PermissionName.view_school_classes_20117,
                            ],
                            organization: organizationWithMembership,
                        })

                        await grantPermissionFactory({
                            user,
                            permissions: [PermissionName.view_my_classes_20118],
                            organization: viewMyClassOrganizationWithMembership,
                        })
                    })

                    it('shows classes across all organizations', async () => {
                        const myClass = await createClass(
                            [],
                            viewMyClassOrganizationWithMembership,
                            {
                                teachers: [user],
                            }
                        )
                            .save()
                            .then((cls) => {
                                return {
                                    id: cls.class_id,
                                    name: cls.class_name,
                                    status: cls.status,
                                }
                            })
                        const visibleClasses = await queryVisibleClasses(token)
                        expect(visibleClasses).to.deep.equalInAnyOrder([
                            classAssignedToSchool,
                            ...classesForOrganization[
                                otherOrganizationWithMembership.organization_id
                            ],
                            myClass,
                        ])
                    })
                }
            )
        })

        // Ensures that the query does not perform joins and duplicate data,
        // otherwise child connections will produce unexpected results as they
        // work with raw SQL and do not benefit from typeorm's deduplication
        it('does not produce duplicates and is compatible child connections', async () => {
            const organization = organizations[0]

            // setup client user with BOTH permissions checked by nonAdminClassScope
            const nonAdmin = await createNonAdminUser(testClient)
            const role = await createRole('role', organization, {
                permissions: [
                    PermissionName.view_users_40110,
                    PermissionName.view_classes_20114,
                    PermissionName.view_school_classes_20117,
                ],
            }).save()
            await createOrganizationMembership({
                user: nonAdmin,
                organization,
                roles: [role],
            }).save()

            // populate so we'd expect duplicates if left joining
            const users = await User.save(createUsers(2))
            const school = await createSchool(organization).save()
            const classes = createClasses(2, organization)
            classes.forEach((c) => {
                c.teachers = Promise.resolve(users)
                c.schools = Promise.resolve([school])
            })

            await Class.save(classes)
            await SchoolMembership.save(
                createSchoolMemberships([...users, nonAdmin], school)
            )
            await OrganizationMembership.save(
                createOrganizationMemberships(users, organization)
            )

            const permissions = new UserPermissions({ id: nonAdmin.user_id })
            const userNode = mapUserToUserConnectionNode(users[0])
            const classesTeaching = await classesTeachingConnection(
                userNode,
                {
                    count: 2,
                },
                createContextLazyLoaders(permissions),
                true
            )
            expect(classesTeaching.totalCount).to.eq(classes.length)
            expect(classesTeaching.edges).to.have.lengthOf(classes.length)
        })
    })

    describe('permissions', () => {
        let adminUser: User
        let memberUser: User
        let noMemberUser: User
        let organization: Organization
        let allPermissionsCount: number
        let roleRelatedPermissionsCount: number

        const queryVisiblePermissions = async (token?: string) => {
            const response = await permissionsConnection(
                testClient,
                'FORWARD',
                true,
                {},
                { authorization: token }
            )
            return response
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            memberUser = await createUser().save()
            noMemberUser = await createUser().save()

            organization = await createOrganization(memberUser).save()

            await connection.manager.save(
                createOrganizationMembership({
                    user: memberUser,
                    organization,
                })
            )

            allPermissionsCount = await Permission.count()
            roleRelatedPermissionsCount = await Permission.createQueryBuilder(
                'Permission'
            )
                .innerJoin('Permission.roles', 'Role')
                .getCount()
        })

        context('when user is logged in', () => {
            context('and user is admin', () => {
                it('allows access to all the permissions', async () => {
                    const token = generateToken(userToPayload(adminUser))
                    const visiblePermissions = await queryVisiblePermissions(
                        token
                    )
                    expect(visiblePermissions.totalCount).to.eql(
                        allPermissionsCount
                    )
                })
            })

            // fails because src/permission/persmissionInfo.csv & tests/fixtures/permissions.csv are not in sync
            // TODO: should be un-skipped as part of AD-2521
            context('and user is organization member', () => {
                it.skip('allows access just to role related permissions', async () => {
                    const token = generateToken(userToPayload(memberUser))
                    const visiblePermissions = await queryVisiblePermissions(
                        token
                    )
                    expect(visiblePermissions.totalCount).to.eql(
                        roleRelatedPermissionsCount
                    )
                })
            })

            context('and user is non member user', () => {
                it('deny access to any permission', async () => {
                    const token = generateToken(userToPayload(noMemberUser))
                    const visiblePermissions = await queryVisiblePermissions(
                        token
                    )
                    expect(visiblePermissions.totalCount).to.eql(0)
                })
            })
        })
    })

    describe('roles', async () => {
        let usersList: User[] = []
        let superAdmin: User
        let user: User
        let roleList: Role[] = []
        let organizations: Organization[] = []
        let orgMemberships: OrganizationMembership[]

        beforeEach(async () => {
            usersList = []
            roleList = []
            organizations = []
            orgMemberships = []

            superAdmin = await createAdminUser(testClient)

            // create two orgs and one role per org
            for (let i = 0; i < 2; i++) {
                const org = await createOrganization(superAdmin).save()
                organizations.push(org)
                const role = createRole('role ' + i, org)
                await connection.manager.save(role)
                roleList.push(role)
            }

            const anotherRole = createRole('role 0b', organizations[0])
            await connection.manager.save(anotherRole)
            roleList.push(anotherRole)

            for (let i = 0; i < 10; i++) {
                usersList.push(createUser())
            }

            await connection.manager.save(usersList)

            for (let j = 0; j < 5; j++) {
                orgMemberships.push(
                    createOrganizationMembership({
                        user: usersList[j],
                        organization: organizations[0],
                        roles: [roleList[0], roleList[2]],
                    })
                )
            }

            for (let j = 5; j < usersList.length; j++) {
                orgMemberships.push(
                    createOrganizationMembership({
                        user: usersList[j],
                        organization: organizations[1],
                        roles: [roleList[1]],
                    })
                )
            }

            await OrganizationMembership.save(orgMemberships)
        })

        it("non admin scope doesn't join to other tables", async () => {
            const nonAdmin = usersList[0]

            const userPermissions = new UserPermissions({
                id: nonAdmin.user_id,
                email: nonAdmin.email || '',
            })

            const scope = (await createEntityScope({
                permissions: userPermissions,
                entity: 'role',
            })) as SelectQueryBuilder<Role>

            expect(scope.expressionMap.joinAttributes.length).to.eq(0)
        })

        context('admin', () => {
            it('can see all the existent roles', async () => {
                const userPermissions = new UserPermissions({
                    id: superAdmin.user_id,
                    email: superAdmin.email || '',
                })

                const scope = (await createEntityScope({
                    permissions: userPermissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const results = await scope.getMany()
                const orgRoles = results.filter((r) => r.system_role === false)
                const systemRoles = results.filter(
                    (r) => r.system_role === true
                )

                expect(results).to.have.lengthOf(8)
                expect(orgRoles).to.have.lengthOf(3)
                expect(systemRoles).to.have.lengthOf(5)
            })
        })

        context('non admin', () => {
            it('can see its roles or the system ones', async () => {
                user = usersList[9]
                const userPermissions = new UserPermissions({
                    id: user.user_id,
                    email: user.email || '',
                })

                const scope = (await createEntityScope({
                    permissions: userPermissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const results = await scope.getMany()
                const ownedRoles = results.filter(
                    (r) => r.system_role === false
                )
                const systemRoles = results.filter(
                    (r) => r.system_role === true
                )

                expect(results).to.have.lengthOf(6)
                expect(ownedRoles).to.have.lengthOf(1)
                expect(systemRoles).to.have.lengthOf(5)
            })

            it('can not see roles from other orgs', async () => {
                user = usersList[9]
                const userPermissions = new UserPermissions({
                    id: user.user_id,
                    email: user.email || '',
                })

                const scope = (await createEntityScope({
                    permissions: userPermissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const results = await scope.getMany()
                const rolesFromOtherOrgs = results.find(
                    (r) => r.role_name === roleList[0].role_name
                )

                expect(rolesFromOtherOrgs).to.be.an('undefined')
            })

            it('nonAdminRoleScope works even with filter applied', async () => {
                user = usersList[0]
                const userPermissions = new UserPermissions({
                    id: user.user_id,
                    email: user.email || '',
                })

                const scope = (await createEntityScope({
                    permissions: userPermissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const filteredName = roleList[2].role_name
                scope.andWhere('Role.role_name = :filteredName', {
                    filteredName,
                })

                const results = await scope.getMany()
                const ownedRoles = results.filter(
                    (r) => r.system_role === false
                )

                expect(results).to.have.lengthOf(1)
                expect(ownedRoles).to.have.lengthOf(1)
                expect(results[0].role_name).to.equal(filteredName)
            })
        })

        context('non member', () => {
            it('can just see the system ones', async () => {
                const noMember = await createUser().save()
                const userPermissions = new UserPermissions({
                    id: noMember.user_id,
                    email: noMember.email || '',
                })

                const scope = (await createEntityScope({
                    permissions: userPermissions,
                    entity: 'role',
                })) as SelectQueryBuilder<Role>

                const results = await scope.getMany()
                const orgRoles = results.filter((r) => r.system_role === false)
                const systemRoles = results.filter(
                    (r) => r.system_role === true
                )

                expect(results).to.have.lengthOf(5)
                expect(orgRoles).to.have.lengthOf(0)
                expect(systemRoles).to.have.lengthOf(5)
            })
        })
    })

    describe('schools', () => {
        context('nonAdminSchoolScope', async () => {
            let clientUser: User
            let school1: School
            let org1: Organization
            let otherUser: User
            let school2: School
            let org2: Organization
            let school3: School
            let clientPermissions: UserPermissions
            let schoolMemberships: Map<User, School[]>
            let orgMemberships: Map<User, Organization[]>
            let scope: SelectQueryBuilder<School>

            beforeEach(async () => {
                clientUser = await createUser().save()
                otherUser = await createUser().save()
                org1 = await createOrganization().save()
                org2 = await createOrganization().save()
                school1 = await createSchool(org1, 'Scoo').save()
                school2 = await createSchool(org2, 'By').save()
                school3 = await createSchool(org1, 'Doo').save()
            })

            context(
                'client user has both view-school permissions',
                async () => {
                    beforeEach(async () => {
                        const role = await createRole(undefined, undefined, {
                            permissions: [
                                PermissionName.view_school_20110,
                                PermissionName.view_my_school_20119,
                            ],
                        }).save()

                        orgMemberships = new Map([
                            [clientUser, [org1]],
                            [otherUser, [org2]],
                        ])

                        for (const [user, orgs] of orgMemberships) {
                            for (const organization of orgs) {
                                await createOrganizationMembership({
                                    user,
                                    organization,
                                    roles: [role],
                                }).save()
                            }
                        }

                        schoolMemberships = new Map([
                            [clientUser, [school1, school3]],
                            [otherUser, [school2, school3]],
                        ])

                        for (const [user, schools] of schoolMemberships) {
                            for (const school of schools) {
                                await createSchoolMembership({
                                    user,
                                    school,
                                }).save()
                            }
                        }

                        const token = { id: clientUser.user_id }
                        clientPermissions = new UserPermissions(token)
                        scope = (await createEntityScope({
                            permissions: clientPermissions,
                            entity: 'school',
                        })) as SelectQueryBuilder<School>
                    })

                    it("limits scope to a user's schools", async () => {
                        const schools = await scope.select('School').getMany()
                        expect(
                            schools.map((school) => school.school_id)
                        ).deep.equalInAnyOrder(
                            schoolMemberships
                                .get(clientUser)!
                                .map((school) => school.school_id)
                        )
                    })

                    // use case for this is schoolConnection child on usersConnection
                    it('when filtering by another user, shows intersection of schools both users belong to', async () => {
                        scope.select('School')
                        scope.innerJoin(
                            SchoolMembership,
                            'SchoolMembership',
                            'School.school_id = SchoolMembership.schoolSchoolId'
                        )

                        // if nonAdminSchoolScope joined to SchoolMembership itself
                        // then it would now be filtering on 2 mutually exclusive conditions
                        scope.andWhere(
                            'SchoolMembership.userUserId = :userId',
                            {
                                userId: otherUser.user_id,
                            }
                        )

                        const schools = await scope.getMany()

                        expect(
                            schools.map((school) => school.school_id)
                        ).deep.equalInAnyOrder([school3.school_id])
                    })
                }
            )

            // The rest of the contexts and tests deal with uses cases for school child connection filtering on user
            context(
                'client user has both view-school permissions in different orgs and is part of a school',
                async () => {
                    beforeEach(async () => {
                        const roleViewSchool = await createRole(
                            undefined,
                            org1,
                            {
                                permissions: [PermissionName.view_school_20110],
                            }
                        ).save()
                        const roleViewMySchool = await createRole(
                            undefined,
                            org2,
                            {
                                permissions: [
                                    PermissionName.view_my_school_20119,
                                ],
                            }
                        ).save()
                        await createOrganizationMembership({
                            user: clientUser,
                            organization: org1,
                            roles: [roleViewSchool],
                        }).save()
                        await createOrganizationMembership({
                            user: clientUser,
                            organization: org2,
                            roles: [roleViewMySchool],
                        }).save()
                        await createOrganizationMembership({
                            user: otherUser,
                            organization: org2,
                            roles: [],
                        }).save()

                        schoolMemberships = new Map([
                            [clientUser, [school1, school2]],
                            [otherUser, [school2]],
                        ])
                        for (const [user, schools] of schoolMemberships) {
                            for (const school of schools) {
                                await createSchoolMembership({
                                    user,
                                    school,
                                }).save()
                            }
                        }

                        const token = { id: clientUser.user_id }
                        clientPermissions = new UserPermissions(token)
                        scope = (await createEntityScope({
                            permissions: clientPermissions,
                            entity: 'school',
                        })) as SelectQueryBuilder<School>
                    })

                    it('when filtering by another user, shows intersection of schools both users belong to as well as schools of their orgs', async () => {
                        scope.select('School')

                        const schools = await scope.getMany()

                        expect(
                            schools.map((school) => school.school_id)
                        ).deep.equalInAnyOrder([
                            school1.school_id,
                            school2.school_id,
                            school3.school_id,
                        ])
                    })
                }
            )

            context(
                'client user has both view-school permissions in different orgs and is NOT part of a school',
                async () => {
                    beforeEach(async () => {
                        const roleViewSchool = await createRole(
                            undefined,
                            org1,
                            {
                                permissions: [PermissionName.view_school_20110],
                            }
                        ).save()
                        const roleViewMySchool = await createRole(
                            undefined,
                            org2,
                            {
                                permissions: [
                                    PermissionName.view_my_school_20119,
                                ],
                            }
                        ).save()
                        await createOrganizationMembership({
                            user: clientUser,
                            organization: org1,
                            roles: [roleViewSchool],
                        }).save()
                        await createOrganizationMembership({
                            user: clientUser,
                            organization: org2,
                            roles: [roleViewMySchool],
                        }).save()
                        await createOrganizationMembership({
                            user: otherUser,
                            organization: org2,
                            roles: [],
                        }).save()
                        await createSchoolMembership({
                            user: otherUser,
                            school: school2,
                        }).save()

                        const token = { id: clientUser.user_id }
                        clientPermissions = new UserPermissions(token)
                        scope = (await createEntityScope({
                            permissions: clientPermissions,
                            entity: 'school',
                        })) as SelectQueryBuilder<School>
                    })

                    it('when filtering by another user, only shows client org schools (view_school) and not other user school (even if view_my_school)', async () => {
                        scope.select('School')

                        const schools = await scope.getMany()

                        expect(
                            schools.map((school) => school.school_id)
                        ).deep.equalInAnyOrder([
                            school1.school_id,
                            school3.school_id,
                        ])
                    })
                }
            )

            context(
                'client user has view_my_school_20119 permission, cannot see other user schools without view_school_20110 permission',
                async () => {
                    beforeEach(async () => {
                        const role = await createRole(undefined, undefined, {
                            permissions: [PermissionName.view_my_school_20119],
                        }).save()

                        // Both client and other user are part of same org
                        // But without view_school_20110, client user should not see other user's schools
                        orgMemberships = new Map([
                            [clientUser, [org1, org2]],
                            [otherUser, [org2]],
                        ])

                        for (const [user, orgs] of orgMemberships) {
                            for (const organization of orgs) {
                                await createOrganizationMembership({
                                    user,
                                    organization,
                                    roles: [role],
                                }).save()
                            }
                        }

                        schoolMemberships = new Map([
                            [clientUser, [school1]],
                            [otherUser, [school2, school3]],
                        ])

                        for (const [user, schools] of schoolMemberships) {
                            for (const school of schools) {
                                await createSchoolMembership({
                                    user,
                                    school,
                                }).save()
                            }
                        }

                        const token = { id: clientUser.user_id }
                        clientPermissions = new UserPermissions(token)
                        scope = (await createEntityScope({
                            permissions: clientPermissions,
                            entity: 'school',
                        })) as SelectQueryBuilder<School>
                    })

                    it('when client filters by another user, only sees client school and not other user school', async () => {
                        scope.select('School')
                        scope.where(
                            new Brackets((qb) => {
                                qb.andWhere(
                                    'SchoolMembership.userUserId = :userId',
                                    {
                                        userId: otherUser.user_id,
                                    }
                                ).orWhere(
                                    'SchoolMembership.userUserId = :userId',
                                    {
                                        userId: clientUser.user_id,
                                    }
                                )
                            })
                        )

                        const schools = await scope.getMany()

                        expect(
                            schools.map((school) => school.school_id)
                        ).deep.equalInAnyOrder([school1.school_id])
                    })
                }
            )

            context(
                'client user has view_school_20110 permission only, cannot see own school in other org without view_my_school_20119',
                async () => {
                    beforeEach(async () => {
                        const role = await createRole(undefined, undefined, {
                            permissions: [PermissionName.view_school_20110],
                        }).save()

                        orgMemberships = new Map([
                            [clientUser, [org2]],
                            [otherUser, [org2]],
                        ])

                        for (const [user, orgs] of orgMemberships) {
                            for (const organization of orgs) {
                                await createOrganizationMembership({
                                    user,
                                    organization,
                                    roles: [role],
                                }).save()
                            }
                        }

                        schoolMemberships = new Map([
                            [clientUser, [school1]], // This school is in org1 which clientUser is not part of
                            [otherUser, [school2]], // This school is in org2 which clientUser is part of
                        ])

                        for (const [user, schools] of schoolMemberships) {
                            for (const school of schools) {
                                await createSchoolMembership({
                                    user,
                                    school,
                                }).save()
                            }
                        }

                        const token = { id: clientUser.user_id }
                        clientPermissions = new UserPermissions(token)
                        scope = (await createEntityScope({
                            permissions: clientPermissions,
                            entity: 'school',
                        })) as SelectQueryBuilder<School>
                    })

                    it('when client filters by another user, only sees other schools and not client school', async () => {
                        scope.select('School')

                        const schools = await scope.getMany()

                        expect(
                            schools.map((school) => school.school_id)
                        ).deep.equalInAnyOrder([school2.school_id])
                    })
                }
            )

            context(
                'client user has no view-school permissions in their orgs',
                async () => {
                    beforeEach(async () => {
                        const role = await createRole(undefined, undefined, {
                            permissions: [],
                        }).save()

                        orgMemberships = new Map([
                            [clientUser, [org1, org2]],
                            [otherUser, [org2]],
                        ])

                        for (const [user, orgs] of orgMemberships) {
                            for (const organization of orgs) {
                                await createOrganizationMembership({
                                    user,
                                    organization,
                                    roles: [role],
                                }).save()
                            }
                        }

                        schoolMemberships = new Map([
                            [clientUser, [school1, school2, school3]],
                            [otherUser, [school2]],
                        ])

                        for (const [user, schools] of schoolMemberships) {
                            for (const school of schools) {
                                await createSchoolMembership({
                                    user,
                                    school,
                                }).save()
                            }
                        }

                        const token = { id: clientUser.user_id }
                        clientPermissions = new UserPermissions(token)
                        scope = (await createEntityScope({
                            permissions: clientPermissions,
                            entity: 'school',
                        })) as SelectQueryBuilder<School>
                    })

                    it('when client filters by another user, should not see any school related to either client or other user', async () => {
                        scope.select('School')

                        const schools = await scope.getMany()

                        expect(
                            schools.map((school) => school.school_id)
                        ).deep.equal([])
                    })
                }
            )
        })
    })

    describe('subcategories', () => {
        let adminUser: User
        let memberUser: User
        let noMemberUser: User
        let organization: Organization
        let organization2: Organization
        let allSubcategoriesCount: number
        let systemSubcategoriesCount: number
        const organizationSubcategoriesCount = 10

        const queryVisiblePermissions = async (token: string) => {
            const response = await subcategoriesConnection(
                testClient,
                'FORWARD',
                {},
                true,
                { authorization: token }
            )
            return response
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            memberUser = await createUser().save()
            noMemberUser = await createUser().save()
            organization = await createOrganization(memberUser).save()

            await Subcategory.save(
                Array.from(Array(organizationSubcategoriesCount), () =>
                    createSubcategory(organization)
                )
            )

            await Subcategory.save(
                Array.from(Array(organizationSubcategoriesCount), () =>
                    createSubcategory(organization2)
                )
            )

            await createOrganizationMembership({
                user: memberUser,
                organization,
            }).save()

            allSubcategoriesCount = await Subcategory.count()
            systemSubcategoriesCount = await Subcategory.countBy({
                system: true,
            })
        })

        context('admin', () => {
            it('allows access to all the subcategories', async () => {
                const token = generateToken(userToPayload(adminUser))
                const visiblePermissions = await queryVisiblePermissions(token)
                expect(visiblePermissions.totalCount).to.eql(
                    allSubcategoriesCount
                )
            })
        })

        context('organization member', () => {
            it('allows access to system subcategories and owns', async () => {
                const token = generateToken(userToPayload(memberUser))
                const visiblePermissions = await queryVisiblePermissions(token)
                expect(visiblePermissions.totalCount).to.eql(
                    systemSubcategoriesCount + organizationSubcategoriesCount
                )
            })
        })

        context('no member user', () => {
            it('alows access just to system subcategories', async () => {
                const token = generateToken(userToPayload(noMemberUser))
                const visiblePermissions = await queryVisiblePermissions(token)
                expect(visiblePermissions.totalCount).to.eql(
                    systemSubcategoriesCount
                )
            })
        })
    })

    describe('grades', () => {
        let adminUser: User
        let memberUser1: User
        let noMemberUser: User
        let organization1: Organization
        let organization2: Organization
        let allGradesCount: number
        let systemGradesCount: number
        const organizationGradesCount = 6

        const queryVisibleGrades = async (token?: string) => {
            const response = await gradesConnection(
                testClient,
                'FORWARD',
                {},
                { authorization: token }
            )
            return response
        }

        beforeEach(async () => {
            // Generating system grades
            await GradesInitializer.run()
            systemGradesCount = await Grade.count()

            // Creating Users and Orgs
            adminUser = await createAdminUser(testClient)
            memberUser1 = await createUser().save()
            noMemberUser = await createUser().save()
            organization1 = await createOrganization(memberUser1).save()
            organization2 = await createOrganization().save()

            // Creating Grades for organization1
            await Grade.save(
                Array.from(Array(organizationGradesCount), () =>
                    createGrade(organization1)
                )
            )

            // Creating Grades for organization2
            await Grade.save(
                Array.from(Array(organizationGradesCount), () =>
                    createGrade(organization2)
                )
            )

            // Creating membership for memberUser1 in organization1
            await createOrganizationMembership({
                user: memberUser1,
                organization: organization1,
            }).save()

            allGradesCount = await Grade.count()
        })

        context('when user is logged in', () => {
            context('and user is an admin', () => {
                it('should have access to all the existent grades', async () => {
                    const token = generateToken(userToPayload(adminUser))
                    const visibleGrades = await queryVisibleGrades(token)

                    expect(visibleGrades.totalCount).to.eql(allGradesCount)
                })
            })

            context('and user is an organization member', () => {
                it('should have access to the organization and system ones', async () => {
                    const token = generateToken(userToPayload(memberUser1))
                    const visibleGrades = await queryVisibleGrades(token)

                    expect(visibleGrades.totalCount).to.eql(
                        organizationGradesCount + systemGradesCount
                    )
                })
            })

            context('and user does not belongs to any organization', () => {
                it('should have access just to the system ones', async () => {
                    const token = generateToken(userToPayload(noMemberUser))
                    const visibleGrades = await queryVisibleGrades(token)

                    expect(visibleGrades.totalCount).to.eql(systemGradesCount)
                })
            })
        })
    })

    describe('subcategories', () => {
        let adminUser: User
        let memberUser: User
        let noMemberUser: User
        let organization: Organization
        let organization2: Organization
        let allSubcategoriesCount: number
        let systemSubcategoriesCount: number
        const organizationSubcategoriesCount = 10

        const queryVisibleSubcategories = async (token: string) => {
            const response = await subcategoriesConnection(
                testClient,
                'FORWARD',
                {},
                true,
                { authorization: token }
            )
            return response
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            memberUser = await createUser().save()
            noMemberUser = await createUser().save()
            organization = await createOrganization(memberUser).save()

            await Subcategory.save(
                Array.from(Array(organizationSubcategoriesCount), () =>
                    createSubcategory(organization)
                )
            )

            await Subcategory.save(
                Array.from(Array(organizationSubcategoriesCount), () =>
                    createSubcategory(organization2)
                )
            )

            await createOrganizationMembership({
                user: memberUser,
                organization,
            }).save()

            allSubcategoriesCount = await Subcategory.count()
            systemSubcategoriesCount = await Subcategory.countBy({
                system: true,
            })
        })

        context('admin', () => {
            it('allows access to all the subcategories', async () => {
                const token = generateToken(userToPayload(adminUser))
                const visibleSubcategories = await queryVisibleSubcategories(
                    token
                )
                expect(visibleSubcategories.totalCount).to.eql(
                    allSubcategoriesCount
                )
            })
        })

        context('organization member', () => {
            it('allows access to system subcategories and owns', async () => {
                const token = generateToken(userToPayload(memberUser))
                const visibleSubcategories = await queryVisibleSubcategories(
                    token
                )
                expect(visibleSubcategories.totalCount).to.eql(
                    systemSubcategoriesCount + organizationSubcategoriesCount
                )
            })
        })

        context('no member user', () => {
            it('alows access just to system subcategories', async () => {
                const token = generateToken(userToPayload(noMemberUser))
                const visibleSubcategories = await queryVisibleSubcategories(
                    token
                )
                expect(visibleSubcategories.totalCount).to.eql(
                    systemSubcategoriesCount
                )
            })
        })
    })

    describe('ageRanges', () => {
        let adminUser: User
        let memberUser1: User
        let noMemberUser: User
        let organization1: Organization
        let organization2: Organization
        let allAgeRangesCount: number
        let systemAgeRangesCount: number
        const organizationAgeRangesCount = 6

        const queryVisibleAgeRanges = async (token?: string) => {
            const response = await ageRangesConnection(
                testClient,
                'FORWARD',
                {},
                true,
                { authorization: token }
            )

            return response
        }

        beforeEach(async () => {
            systemAgeRangesCount = await AgeRange.count()

            // Creating Users and Orgs
            adminUser = await createAdminUser(testClient)
            memberUser1 = await createUser().save()
            noMemberUser = await createUser().save()
            organization1 = await createOrganization(memberUser1).save()
            organization2 = await createOrganization().save()

            // Creating Age Ranges for organization1
            await AgeRange.save(
                Array.from(Array(organizationAgeRangesCount), () =>
                    createAgeRange(organization1)
                )
            )

            // Creating Age Ranges for organization2
            await AgeRange.save(
                Array.from(Array(organizationAgeRangesCount), () =>
                    createAgeRange(organization2)
                )
            )

            // Creating membership for memberUser1 in organization1
            await createOrganizationMembership({
                user: memberUser1,
                organization: organization1,
            }).save()

            allAgeRangesCount = await AgeRange.count()
        })

        context('when user is logged in', () => {
            context('and user is an admin', () => {
                it('should have access to all the existent age ranges', async () => {
                    const token = generateToken(userToPayload(adminUser))
                    const visibleAgeRanges = await queryVisibleAgeRanges(token)

                    expect(visibleAgeRanges.totalCount).to.eql(
                        allAgeRangesCount
                    )
                })
            })

            context('and user is an organization member', () => {
                it('should have access to the organization and system ones', async () => {
                    const token = generateToken(userToPayload(memberUser1))
                    const visibleAgeRanges = await queryVisibleAgeRanges(token)

                    expect(visibleAgeRanges.totalCount).to.eql(
                        organizationAgeRangesCount + systemAgeRangesCount
                    )
                })
            })

            context('and user does not belongs to any organization', () => {
                it('should have access just to the system ones', async () => {
                    const token = generateToken(userToPayload(noMemberUser))
                    const visibleAgeRanges = await queryVisibleAgeRanges(token)

                    expect(visibleAgeRanges.totalCount).to.eql(
                        systemAgeRangesCount
                    )
                })
            })
        })
    })

    describe('categories', () => {
        let adminUser: User
        let memberUser: User
        let noMemberUser: User
        let organization: Organization
        let organization2: Organization
        let allCategoriesCount: number
        let systemCategoriesCount: number
        const organizationCategoriesCount = 10

        const queryVisibleCategories = async (token: string) => {
            const response = await categoriesConnection(
                testClient,
                'FORWARD',
                {},
                { authorization: token }
            )
            return response
        }

        beforeEach(async () => {
            adminUser = await createAdminUser(testClient)
            memberUser = await createUser().save()
            noMemberUser = await createUser().save()
            organization = await createOrganization(memberUser).save()

            await Category.save(
                Array.from(Array(organizationCategoriesCount), () =>
                    createCategory(organization)
                )
            )

            await Category.save(
                Array.from(Array(organizationCategoriesCount), () =>
                    createCategory(organization2)
                )
            )

            await createOrganizationMembership({
                user: memberUser,
                organization,
            }).save()

            allCategoriesCount = await Category.count()
            systemCategoriesCount = await Category.countBy({
                system: true,
            })
        })

        context('admin', () => {
            it('allows access to all the categories', async () => {
                const token = generateToken(userToPayload(adminUser))
                const visibleCategories = await queryVisibleCategories(token)
                expect(visibleCategories.totalCount).to.eql(allCategoriesCount)
            })
        })

        context('organization member', () => {
            it('allows access to system categories and owns', async () => {
                const token = generateToken(userToPayload(memberUser))
                const visibleCategories = await queryVisibleCategories(token)
                expect(visibleCategories.totalCount).to.eql(
                    systemCategoriesCount + organizationCategoriesCount
                )
            })
        })

        context('no member user', () => {
            it('alows access just to system categories', async () => {
                const token = generateToken(userToPayload(noMemberUser))
                const visibleCategories = await queryVisibleCategories(token)
                expect(visibleCategories.totalCount).to.eql(
                    systemCategoriesCount
                )
            })
        })
    })

    describe('organizationMemberships', () => {
        let adminScope: SelectQueryBuilder<OrganizationMembership>
        let nonAdminScope: SelectQueryBuilder<OrganizationMembership>

        let org1: Organization
        let org2: Organization
        let org1Memberships: OrganizationMembership[]
        let org2Memberships: OrganizationMembership[]

        let admin: User
        let nonAdmin: User

        function ids(arr: OrganizationMembership[]) {
            return arr.map((m) => m.user_id + m.organization_id)
        }

        beforeEach(async () => {
            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            org1Memberships = await Promise.all([
                createOrganizationMembership({
                    organization: org1,
                    user: await createUser().save(),
                }).save(),
                createOrganizationMembership({
                    organization: org1,
                    user: await createUser().save(),
                }).save(),
            ])
            org2Memberships = await Promise.all([
                createOrganizationMembership({
                    organization: org2,
                    user: await createUser().save(),
                }).save(),
                createOrganizationMembership({
                    organization: org2,
                    user: await createUser().save(),
                }).save(),
            ])

            admin = await createAdminUser(testClient)
            nonAdmin = await createNonAdminUser(testClient)
            adminScope = (await createEntityScope({
                permissions: new UserPermissions({
                    id: admin.user_id,
                    email: admin.email!,
                }),
                entity: 'organizationMembership',
            })) as SelectQueryBuilder<OrganizationMembership>
            nonAdminScope = (await createEntityScope({
                permissions: new UserPermissions({
                    id: nonAdmin.user_id,
                    email: nonAdmin.email!,
                }),
                entity: 'organizationMembership',
            })) as SelectQueryBuilder<OrganizationMembership>
        })
        context('admin', () => {
            it('can see all organization memberships', async () => {
                const results = await adminScope.getMany()
                expect(ids(results)).to.have.members(
                    ids([...org1Memberships, ...org2Memberships])
                )
            })
        })
        context('organization member', () => {
            let membership: OrganizationMembership
            beforeEach(async () => {
                membership = await createOrganizationMembership({
                    organization: org1,
                    user: nonAdmin,
                }).save()
                org1Memberships.push(membership)
                nonAdminScope = (await createEntityScope({
                    permissions: new UserPermissions({
                        id: nonAdmin.user_id,
                        email: nonAdmin.email!,
                    }),
                    entity: 'organizationMembership',
                })) as SelectQueryBuilder<OrganizationMembership>
            })
            context('with permissions to view other users', () => {
                beforeEach(async () => {
                    const role = await createRole('r', org1, {
                        permissions: [PermissionName.view_users_40110],
                    }).save()
                    membership.roles = Promise.resolve([role])
                    await membership.save()

                    nonAdminScope = (await createEntityScope({
                        permissions: new UserPermissions({
                            id: nonAdmin.user_id,
                            email: nonAdmin.email!,
                        }),
                        entity: 'organizationMembership',
                    })) as SelectQueryBuilder<OrganizationMembership>
                })
                it('can see organization memberships from their orgs only', async () => {
                    const results = await nonAdminScope.getMany()
                    expect(ids(results)).to.have.members(ids(org1Memberships))
                })
            })
            context('without permission to view other users', () => {
                it('can see their organization memberships only', async () => {
                    const results = await nonAdminScope.getMany()
                    expect(ids(results)).to.have.members(ids([membership]))
                })
            })
        })
        context('no organization user', () => {
            it('can see no organization memberships', async () => {
                const results = await nonAdminScope.getMany()
                expect(results).to.have.lengthOf(0)
            })
        })
    })
    context('schools', () => {
        let admin: User
        let orgOwner: User
        let schoolAdmin: User
        let orgMember: User
        let ownerAndSchoolAdmin: User
        let org1: Organization
        let org2: Organization
        let org3: Organization
        let org1Schools: School[] = []
        let org2Schools: School[] = []
        let org3Schools: School[] = []
        const schools: School[] = []
        let scope: SelectQueryBuilder<School>
        let adminPermissions: UserPermissions
        let orgOwnerPermissions: UserPermissions
        let schoolAdminPermissions: UserPermissions
        let ownerAndSchoolAdminPermissions: UserPermissions
        let viewMySchoolRole: Role
        const schoolsCount = 12
        const organizationsCount = 3

        let ctx: Context

        const buildScopeAndContext = async (permissions: UserPermissions) => {
            if (!permissions.isAdmin) {
                await nonAdminSchoolScope(scope, permissions)
            }

            ctx = ({
                permissions,
                loaders: createContextLazyLoaders(permissions),
            } as unknown) as Context
        }

        const querySchools = async (token: string) => {
            const response = await schoolsConnection(
                testClient,
                'FORWARD',
                {},
                true,
                { authorization: token }
            )
            return response
        }

        beforeEach(async () => {
            scope = School.createQueryBuilder('School')

            admin = await createAdminUser(testClient)
            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            org3 = await createOrganization().save()

            // creating org1 schools
            org1Schools = await School.save(
                Array.from(Array(schoolsCount), (_, i) => {
                    const s = createSchool(org1)
                    s.school_name = `school ${i}`
                    return s
                })
            )

            // creating org2 schools
            org2Schools = await School.save(
                Array.from(Array(schoolsCount), (_, i) => {
                    const c = createSchool(org2)
                    c.school_name = `school ${i}`
                    return c
                })
            )

            // creating org3 schools
            org3Schools = await School.save(
                Array.from(Array(schoolsCount), (_, i) => {
                    const s = createSchool(org3)
                    s.school_name = `school ${i}`
                    return s
                })
            )

            schools.push(...org1Schools, ...org2Schools, ...org3Schools)

            adminPermissions = new UserPermissions(userToPayload(admin))

            // Emulating context
            await buildScopeAndContext(adminPermissions)

            orgOwner = await createUser().save()
            schoolAdmin = await createUser().save()
            orgMember = await createUser().save()
            ownerAndSchoolAdmin = await createUser().save()

            const viewAllSchoolsRoleOrg3 = await createRole(
                'View Schools',
                org3,
                {
                    permissions: [PermissionName.view_school_20110],
                }
            ).save()

            const viewAllSchoolsFromTheOrgRole = await createRole(
                'View Schools',
                org2,
                {
                    permissions: [PermissionName.view_school_20110],
                }
            ).save()

            viewMySchoolRole = await createRole('View My School', org3, {
                permissions: [PermissionName.view_my_school_20119],
            }).save()

            // adding orgOwner to org3 with orgAdminRole
            await createOrganizationMembership({
                user: orgOwner,
                organization: org3,
                roles: [viewAllSchoolsRoleOrg3],
            }).save()

            const fakeTeacherRole = await createRole('View my Schools', org2, {
                permissions: [PermissionName.view_my_school_20119],
            }).save()

            await createOrganizationMembership({
                user: orgOwner,
                organization: org2,
                roles: [fakeTeacherRole],
            }).save()

            // adding ownerAndSchoolAdmin to org2 with orgAdminRole
            await createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org2,
                roles: [viewAllSchoolsFromTheOrgRole],
            }).save()

            // adding schoolAdmin to org3 with schoolAdminRole
            await createOrganizationMembership({
                user: schoolAdmin,
                organization: org3,
                roles: [viewMySchoolRole],
            }).save()

            // adding ownerAndSchoolAdmin to org3 with schoolAdminRole
            await createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org3,
                roles: [viewMySchoolRole],
            }).save()

            // adding ownerAndSchoolAdmin to second org3School
            await createSchoolMembership({
                user: ownerAndSchoolAdmin,
                school: org3Schools[1],
                roles: [viewMySchoolRole],
            }).save()

            // adding orgMember to org3
            await createOrganizationMembership({
                user: orgMember,
                organization: org3,
                roles: [],
            }).save()

            orgOwnerPermissions = new UserPermissions(userToPayload(orgOwner))
            schoolAdminPermissions = new UserPermissions(
                userToPayload(schoolAdmin)
            )
            ownerAndSchoolAdminPermissions = new UserPermissions(
                userToPayload(ownerAndSchoolAdmin)
            )
        })

        context('super admin', () => {
            it('should see schools from all the organizations', async () => {
                const token = generateToken(userToPayload(admin))
                const visibleSchools = await querySchools(token)
                expect(visibleSchools.totalCount).to.eql(
                    schoolsCount * organizationsCount
                )
            })
        })

        // problem is an org admin who is 1) member of > 1 org and 2) has view_school in one and view_my_school in the other
        context('org admin', () => {
            it.only('org admin should see schools from his org', async () => {
                const token = generateToken(userToPayload(orgOwner))
                const visibleSchools = await querySchools(token)
                expect(visibleSchools.totalCount).to.eql(org3Schools.length)
            })

            it('org admin from 1 org and school owner of another org should see schools all the schools from the first org and only the one he owns from org 2', async () => {
                const token = generateToken(userToPayload(ownerAndSchoolAdmin))
                const visibleSchools = await querySchools(token)
                expect(visibleSchools.totalCount).to.eql(org2Schools.length + 1)
            })
        })

        context('school admin', () => {
            context('when a member of school', () => {
                beforeEach(async () => {
                    // adding schoolAdmin to first org3School
                    await createSchoolMembership({
                        user: schoolAdmin,
                        school: org3Schools[0],
                        roles: [viewMySchoolRole],
                    }).save()
                })
                it('school admin should see only their school', async () => {
                    const token = generateToken(userToPayload(schoolAdmin))
                    const visibleSchools = await querySchools(token)
                    expect(visibleSchools.totalCount).to.eql(1)
                })
            })
            context('when not a member of school', () => {
                it('should see no schools', async () => {
                    const token = generateToken(userToPayload(schoolAdmin))
                    const visibleSchools = await querySchools(token)
                    expect(visibleSchools.totalCount).to.eql(0)
                })
            })
        })
    })

    describe('schoolMemberships', () => {
        let admin: User
        let nonAdmin: User
        let adminScope: SelectQueryBuilder<SchoolMembership>
        let nonAdminScope: SelectQueryBuilder<SchoolMembership>

        let school1: School
        let school2: School
        let school1Memberships: SchoolMembership[]
        let school2Memberships: SchoolMembership[]
        let org1: Organization
        let org2: Organization

        beforeEach(async () => {
            admin = await createAdminUser(testClient)
            nonAdmin = await createNonAdminUser(testClient)
            adminScope = (await createEntityScope({
                permissions: new UserPermissions({
                    id: admin.user_id,

                    email: admin.email!,
                }),
                entity: 'schoolMembership',
            })) as SelectQueryBuilder<SchoolMembership>
            nonAdminScope = (await createEntityScope({
                permissions: new UserPermissions({
                    id: nonAdmin.user_id,
                    email: nonAdmin.email!,
                }),
                entity: 'schoolMembership',
            })) as SelectQueryBuilder<SchoolMembership>

            org1 = await createOrganization().save()
            org2 = await createOrganization().save()
            school1 = await createSchool(org1).save()
            school2 = await createSchool(org2).save()

            school1Memberships = await Promise.all([
                createSchoolMembership({
                    school: school1,
                    user: await createUser().save(),
                }).save(),
                createSchoolMembership({
                    school: school1,
                    user: await createUser().save(),
                }).save(),
            ])

            school2Memberships = await Promise.all([
                createSchoolMembership({
                    school: school2,
                    user: await createUser().save(),
                }).save(),
                createSchoolMembership({
                    school: school2,
                    user: await createUser().save(),
                }).save(),
            ])
        })
        context('when user is admin', () => {
            it('can see all school memberships', async () => {
                const members = await adminScope.getMany()
                expect(members).to.have.lengthOf(
                    school1Memberships.length + school2Memberships.length
                )
            })
        })

        context('when user is a school member', () => {
            let membership: SchoolMembership
            beforeEach(async () => {
                membership = await createSchoolMembership({
                    user: nonAdmin,
                    school: school1,
                }).save()
                school1Memberships.push(membership)
                nonAdminScope = (await createEntityScope({
                    permissions: new UserPermissions({
                        id: nonAdmin.user_id,
                        email: nonAdmin.email!,
                    }),
                    entity: 'schoolMembership',
                })) as SelectQueryBuilder<SchoolMembership>
            })
            context('and has permission to view schools and users', () => {
                beforeEach(async () => {
                    const role = await createRole('r', org1, {
                        permissions: [
                            PermissionName.view_school_20110,
                            PermissionName.view_my_school_users_40111,
                        ],
                    }).save()
                    const orgMem = await createOrganizationMembership({
                        user: nonAdmin,
                        organization: org1,
                        roles: [role],
                    }).save()
                    await orgMem.save()

                    nonAdminScope = (await createEntityScope({
                        permissions: new UserPermissions({
                            id: nonAdmin.user_id,
                            email: nonAdmin.email!,
                        }),
                        entity: 'schoolMembership',
                    })) as SelectQueryBuilder<SchoolMembership>
                })
                it('can see memberships from schools', async () => {
                    const members = await nonAdminScope.getMany()
                    expect(members).to.have.lengthOf(school1Memberships.length)
                })
            })

            context(
                'and does not have permission to view schools or users',
                () => {
                    it('returns no memberships', async () => {
                        const members = await nonAdminScope.getMany()
                        expect(members).to.have.lengthOf(0)
                    })
                }
            )
        })

        context('when user is not an org or school member', () => {
            it('cannot see any memberships', async () => {
                const members = await nonAdminScope.getMany()
                expect(members).to.have.lengthOf(0)
            })
        })
    })

    context('subjects', () => {
        let adminUser: User
        let memberUser1: User
        let noMemberUser: User
        let organization1: Organization
        let organization2: Organization
        let allSubjectsCount: number
        let systemSubjectsCount: number
        let token: string
        let visibleSubjects: IPaginatedResponse<SubjectConnectionNode>
        const organizationSubjectsCount = 6

        const queryVisibleSubjects = async (token?: string) => {
            const response = await subjectsConnection(
                testClient,
                'FORWARD',
                {},
                { authorization: token }
            )

            return response
        }

        beforeEach(async () => {
            // Generating system grades
            await SubjectsInitializer.run()
            systemSubjectsCount = await Subject.count()

            // Creating Users and Orgs
            adminUser = await createAdminUser(testClient)
            memberUser1 = await createUser().save()
            noMemberUser = await createUser().save()
            organization1 = await createOrganization(memberUser1).save()
            organization2 = await createOrganization().save()

            // Creating Subjects for organization1
            await Subject.save(
                Array.from(Array(organizationSubjectsCount), () =>
                    createSubject(organization1)
                )
            )

            // Creating Subjects for organization2
            await Subject.save(
                Array.from(Array(organizationSubjectsCount), () =>
                    createSubject(organization2)
                )
            )

            // Creating membership for memberUser1 in organization1
            await createOrganizationMembership({
                user: memberUser1,
                organization: organization1,
            }).save()

            allSubjectsCount = await Subject.count()
        })

        context('when user is an admin', () => {
            it('should have access to all the existent subjects', async () => {
                token = generateToken(userToPayload(adminUser))
                visibleSubjects = await queryVisibleSubjects(token)

                expect(visibleSubjects.totalCount).to.eql(allSubjectsCount)
            })
        })

        context('when user is an organization member', () => {
            it('should have access to the organization and system ones', async () => {
                token = generateToken(userToPayload(memberUser1))
                visibleSubjects = await queryVisibleSubjects(token)

                expect(visibleSubjects.totalCount).to.eql(
                    organizationSubjectsCount + systemSubjectsCount
                )
            })
        })

        context('when user does not belongs to any organization', () => {
            it('should have access just to the system ones', async () => {
                token = generateToken(userToPayload(noMemberUser))
                visibleSubjects = await queryVisibleSubjects(token)

                expect(visibleSubjects.totalCount).to.eql(systemSubjectsCount)
            })
        })
    })
})
