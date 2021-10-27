import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { createTestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import {
    generateToken,
    getAdminAuthToken,
    getNonAdminAuthToken,
} from '../../utils/testConfig'
import {
    classesConnection,
    getAllOrganizations,
    permissionsConnection,
    subcategoriesConnection,
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
import { createOrganization } from '../../factories/organization.factory'
import { createUser } from '../../factories/user.factory'
import { createClass } from '../../factories/class.factory'
import {
    addStudentToClass,
    addTeacherToClass,
} from '../../utils/operations/classOps'
import { Class } from '../../../src/entities/class'
import { pick } from 'lodash'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { ClassConnectionNode } from '../../../src/types/graphQL/classConnectionNode'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { Permission } from '../../../src/entities/permission'
import { nonAdminRoleScope } from '../../../src/directives/isAdmin'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { Subcategory } from '../../../src/entities/subcategory'
import { createSubcategory } from '../../factories/subcategory.factory'
use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('isAdmin', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let originalAdmins: string[]

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
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
                    'Context creation failed: No authentication token'
                )
            })
        })

        context('when user is logged in', () => {
            const orgInfo = (org: Organization) => {
                return org.organization_id
            }
            let otherOrganization: Organization

            beforeEach(async () => {
                const otherUser = await createNonAdminUser(testClient)
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

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([
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
        })
    })

    describe('users', async () => {
        const direction = 'FORWARD'
        let usersList: User[] = []
        let roleList: Role[] = []
        let organizations: Organization[] = []
        let schools: School[] = []

        beforeEach(async () => {
            usersList = []
            roleList = []
            organizations = []
            schools = []

            const superAdmin = await createAdminUser(testClient)

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

            context('view_classes_20114 AND view_school_classes_20117', () => {
                context('in the same organization', () => {
                    beforeEach(async () => {
                        await grantPermissionFactory({
                            user,
                            permissions: [
                                PermissionName.view_classes_20114,
                                PermissionName.view_school_classes_20117,
                            ],
                            organization: organizationWithMembership,
                        })
                    })
                    it('shows all classes in the Organization', async () => {
                        const visibleClasses = await queryVisibleClasses(token)
                        expect(visibleClasses).to.deep.equalInAnyOrder(
                            classesForOrganization[
                                organizationWithMembership.organization_id
                            ]
                        )
                    })
                })

                context('in different organizations', () => {
                    let otherOrganizationWithMembership: Organization
                    beforeEach(async () => {
                        otherOrganizationWithMembership = organizations[1]
                        await createOrganizationMembership({
                            user,
                            organization: otherOrganizationWithMembership,
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
                    })

                    it('shows classes across both organizations', async () => {
                        const visibleClasses = await queryVisibleClasses(token)
                        expect(visibleClasses).to.deep.equalInAnyOrder([
                            classAssignedToSchool,
                            ...classesForOrganization[
                                otherOrganizationWithMembership.organization_id
                            ],
                        ])
                    })
                })
            })
        })
    })

    describe('permissions', () => {
        let adminUser: User
        let memberUser: User
        let noMemberUser: User
        let organization: Organization
        let allPermissionsCount: number
        let roleRelatedPermissionsCount: number

        const queryVisiblePermissions = async (token: string) => {
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

        context('admin', () => {
            it('allows access to all the permissions', async () => {
                const token = generateToken(userToPayload(adminUser))
                const visiblePermissions = await queryVisiblePermissions(token)
                expect(visiblePermissions.totalCount).to.eql(
                    allPermissionsCount
                )
            })
        })

        context('organization member', () => {
            it('allows access just to role related permissions', async () => {
                const token = generateToken(userToPayload(memberUser))
                const visiblePermissions = await queryVisiblePermissions(token)
                expect(visiblePermissions.totalCount).to.eql(
                    roleRelatedPermissionsCount
                )
            })
        })

        context('no member user', () => {
            it('deny access to any permission', async () => {
                const token = generateToken(userToPayload(noMemberUser))
                const visiblePermissions = await queryVisiblePermissions(token)
                expect(visiblePermissions.totalCount).to.eql(0)
            })
        })
    })

    describe('roles', async () => {
        let usersList: User[] = []
        let user: User
        let roleList: Role[] = []
        let organizations: Organization[] = []
        let userPermissions: UserPermissions
        let orgMemberships: OrganizationMembership[]

        beforeEach(async () => {
            usersList = []
            roleList = []
            organizations = []
            orgMemberships = []

            const superAdmin = await createAdminUser(testClient)

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

        context('non admin', () => {
            it('can see its roles or the system ones', async () => {
                user = usersList[9]
                userPermissions = new UserPermissions({
                    id: user.user_id,
                    email: user.email || '',
                })
                user.organization_ownerships
                const scope = Role.createQueryBuilder()
                await nonAdminRoleScope(scope, userPermissions)

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
                userPermissions = new UserPermissions({
                    id: user.user_id,
                    email: user.email || '',
                })
                const scope = Role.createQueryBuilder()
                await nonAdminRoleScope(scope, userPermissions)

                const results = await scope.getMany()
                const rolesFromOtherOrgs = results.find(
                    (r) => r.role_name === roleList[0].role_name
                )

                expect(rolesFromOtherOrgs).to.be.an('undefined')
            })

            it('nonAdminRoleScope works even with filter applied', async () => {
                user = usersList[0]
                userPermissions = new UserPermissions({
                    id: user.user_id,
                    email: user.email || '',
                })
                const scope = Role.createQueryBuilder()
                const filteredName = roleList[2].role_name
                scope.andWhere('Role.role_name = :filteredName', {
                    filteredName,
                })
                await nonAdminRoleScope(scope, userPermissions)

                const results = await scope.getMany()
                const ownedRoles = results.filter(
                    (r) => r.system_role === false
                )

                expect(results).to.have.lengthOf(1)
                expect(ownedRoles).to.have.lengthOf(1)
                expect(results[0].role_name).to.equal(filteredName)
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
            systemSubcategoriesCount = await Subcategory.count({
                where: { system: true },
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
})
