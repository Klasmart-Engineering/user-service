import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { sortBy } from 'lodash'
import { Like, getConnection } from 'typeorm'
import { Class } from '../../../src/entities/class'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { mapUserToUserConnectionNode } from '../../../src/pagination/usersConnection'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { schoolAdminRole } from '../../../src/permissions/schoolAdmin'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { convertDataToCursor } from '../../../src/utils/pagination/paginate'
import { createClass } from '../../factories/class.factory'
import { createGrade } from '../../factories/grade.factory'
import {
    createOrganization,
    createOrganizations,
} from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import {
    ADMIN_EMAIL,
    createUser,
    createUsers,
} from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    runQuery,
    userConnection,
    usersConnectionMainData,
    usersConnectionNodes,
} from '../../utils/operations/modelOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import { grantPermission } from '../../utils/operations/roleOps'
import {
    addOrganizationToUserAndValidate,
    userToPayload,
} from '../../utils/operations/userOps'
import {
    generateToken,
    getAdminAuthToken,
    getNonAdminAuthToken,
} from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { expectUserConnectionNode } from '../../utils/userConnectionNode'

use(deepEqualInAnyOrder)

describe('usersConnection', () => {
    let usersList: User[] = []
    const direction = 'FORWARD'
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    context('data', () => {
        beforeEach(async () => {
            usersList = await User.save(
                Array(2)
                    .fill(undefined)
                    .map((_) => {
                        const user = createUser()
                        // Populate fields not set in `createUser`
                        user.avatar = 'some_image'
                        user.alternate_email = faker.internet.email()
                        user.alternate_phone = faker.phone.phoneNumber()
                        return user
                    })
            )
            usersList = sortBy(usersList, 'user_id')
        })

        it('populates a UserConnectionNode at each edge.node based on the User entity', async () => {
            const userConnectionResponse = await usersConnectionNodes(
                testClient,
                { authorization: getAdminAuthToken() }
            )

            expect(userConnectionResponse.edges).to.have.length(2)
            userConnectionResponse.edges.forEach((edge, i) =>
                expectUserConnectionNode(edge.node, usersList[i])
            )
        })
    })

    context('permissions', () => {
        let organization: Organization
        let user: User
        let users: User[]
        let schools: School[]
        let organizations: Organization[]

        beforeEach(async () => {
            users = await User.save(createUsers(9))
            user = users[0]
            organizations = await Organization.save(createOrganizations(3))
            organization = organizations[0]

            await OrganizationMembership.save(
                users.map((user, i) =>
                    createOrganizationMembership({
                        user,
                        organization: organizations[i % 3],
                    })
                )
            )

            schools = await School.save([
                createSchool(organizations[0]),
                createSchool(organizations[1]),
            ])

            await SchoolMembership.save([
                createSchoolMembership({
                    user: users[0],
                    school: schools[0],
                }),
                createSchoolMembership({
                    user: users[3],
                    school: schools[0],
                }),
                createSchoolMembership({
                    user: users[1],
                    school: schools[1],
                }),
            ])

            await Class.save([
                createClass(undefined, organizations[0], {
                    students: [users[1], users[5], users[6]],
                    teachers: [users[0]],
                }),
                createClass(undefined, organizations[1], {
                    students: [users[2]],
                    teachers: [users[1]],
                }),
            ])
        })

        context('admin', () => {
            beforeEach(async () => {
                // Make the User an admin
                user.email = ADMIN_EMAIL
                await user.save()
            })
            it('can view all Users', async () => {
                const usersConnectionResponse = await usersConnectionNodes(
                    testClient,
                    { authorization: generateToken(userToPayload(user)) }
                )

                expect(usersConnectionResponse.edges).to.have.length(
                    users.length
                )
            })
        })

        context('non-admin', () => {
            let userWithSameEmail: User
            let userWithSamePhone: User

            beforeEach(async () => {
                userWithSameEmail = createUser({ email: user.email })
                await userWithSameEmail.save()
                userWithSamePhone = createUser({ phone: user.phone })
                await userWithSamePhone.save()
            })

            const addPermission = async ({
                user,
                organization,
                permission,
            }: {
                user: User
                organization: Organization
                permission: PermissionName
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
                    .add(permission)
            }

            context('User with `view_users_40110`', () => {
                beforeEach(
                    async () =>
                        await addPermission({
                            user,
                            organization,
                            permission: PermissionName.view_users_40110,
                        })
                )
                it('can view Users in the Organizations they belong to', async () => {
                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        }
                    )
                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equalInAnyOrder(
                        [
                            users[0],
                            users[3],
                            users[6],
                            userWithSameEmail,
                            userWithSamePhone,
                        ].map(mapUserToUserConnectionNode)
                    )
                })

                it('applies organizationId filters', async () => {
                    await createOrganizationMembership({
                        user,
                        organization: organizations[1],
                    }).save()
                    await addPermission({
                        user,
                        organization: organizations[1],
                        permission: PermissionName.view_users_40110,
                    })

                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        {
                            organizationId: {
                                operator: 'eq',
                                value: organization.organization_id,
                            },
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equalInAnyOrder(
                        [users[0], users[3], users[6]].map(
                            mapUserToUserConnectionNode
                        )
                    )
                })

                it('applies organizationUserStatus filters', async () => {
                    const filteredUser = users[3]
                    await OrganizationMembership.update(
                        {
                            user_id: filteredUser.user_id,
                            organization_id: organization.organization_id,
                        },
                        { status: Status.INACTIVE }
                    )

                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        {
                            organizationUserStatus: {
                                operator: 'eq',
                                value: Status.INACTIVE,
                            },
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equal([mapUserToUserConnectionNode(filteredUser)])
                })

                it('applies userStatus filters', async () => {
                    const filteredUser = users[3]
                    await User.update(
                        {
                            user_id: filteredUser.user_id,
                        },
                        { status: Status.INACTIVE }
                    )
                    filteredUser.status = Status.INACTIVE

                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        {
                            userStatus: {
                                operator: 'eq',
                                value: Status.INACTIVE,
                            },
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equal([mapUserToUserConnectionNode(filteredUser)])
                })

                it('applies roleId filters', async () => {
                    const role = await createRole(
                        undefined,
                        organization
                    ).save()
                    const filteredUser = users[3]
                    await OrganizationMembership.createQueryBuilder()
                        .relation('roles')
                        .of({
                            user_id: filteredUser.user_id,
                            organization_id: organization.organization_id,
                        })
                        .add(role)

                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        {
                            roleId: {
                                operator: 'eq',
                                value: role.role_id,
                            },
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equal([mapUserToUserConnectionNode(filteredUser)])
                })
            })
            context('User with `view_my_school_users_40111', () => {
                beforeEach(
                    async () =>
                        await addPermission({
                            user,
                            organization,
                            permission:
                                PermissionName.view_my_school_users_40111,
                        })
                )
                it('can view Users in the Schools they belong to', async () => {
                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equalInAnyOrder(
                        [
                            user,
                            users[3],
                            userWithSameEmail,
                            userWithSamePhone,
                        ].map(mapUserToUserConnectionNode)
                    )
                })

                it('applies schoolId filters', async () => {
                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        {
                            schoolId: {
                                operator: 'eq',
                                value: schools[1].school_id,
                            },
                        }
                    )

                    expect(usersConnectionResponse.edges).to.have.length(0)
                })
            })
            context('User with `view_my_class_users_40112`', () => {
                beforeEach(
                    async () =>
                        await addPermission({
                            user,
                            organization,
                            permission:
                                PermissionName.view_my_class_users_40112,
                        })
                )
                it('can view Students in the Classes they teach', async () => {
                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equalInAnyOrder(
                        [
                            user,
                            users[1],
                            users[5],
                            users[6],
                            userWithSameEmail,
                            userWithSamePhone,
                        ].map(mapUserToUserConnectionNode)
                    )
                })
            })

            context('User with `view_my_admin_users_40113`', () => {
                let schoolAdmin: User
                beforeEach(async () => {
                    await addPermission({
                        user,
                        organization,
                        permission: PermissionName.view_my_admin_users_40113,
                    })
                    schoolAdmin = await User.save(createUser())
                    const schAdminRole = await Role.findOne({
                        role_name: schoolAdminRole.role_name,
                    })
                    await OrganizationMembership.save(
                        createOrganizationMembership({
                            user: schoolAdmin,
                            organization: organizations[0],
                            roles: [schAdminRole as Role],
                        })
                    )
                })
                it('can view School admins in his schools', async () => {
                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map((edge) => edge.node)
                    ).to.deep.equalInAnyOrder(
                        [user, userWithSameEmail, userWithSamePhone].map(
                            mapUserToUserConnectionNode
                        )
                    )
                })
            })

            context('User with no "view_*_users" permission', () => {
                it('can view Users with the same email or phone', async () => {
                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map(
                            (edge) => edge.node.id
                        )
                    ).to.deep.equalInAnyOrder([
                        user.user_id,
                        userWithSameEmail.user_id,
                        userWithSamePhone.user_id,
                    ])
                })

                it('cannot view other users with email undefined', async () => {
                    user.email = undefined
                    await user.save()
                    const userWithUndefinedEmail = createUser({
                        email: user.email,
                    })
                    await userWithSameEmail.save()

                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map(
                            (edge) => edge.node.id
                        )
                    ).to.not.contain(userWithUndefinedEmail.user_id)
                })

                it('cannot view other users with phone undefined', async () => {
                    user.phone = undefined
                    await user.save()
                    const userWithUndefinedPhone = createUser({
                        phone: user.phone,
                    })
                    await userWithUndefinedPhone.save()

                    const usersConnectionResponse = await usersConnectionNodes(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        }
                    )

                    expect(
                        usersConnectionResponse.edges.map(
                            (edge) => edge.node.id
                        )
                    ).to.not.contain(userWithUndefinedPhone.user_id)
                })
            })
        })
    })

    context('seek forward', () => {
        beforeEach(async () => {
            usersList = []
            const roleList: Role[] = []
            const organizations: Organization[] = []
            const schools: School[] = []
            // create two orgs and two schools
            for (let i = 0; i < 2; i++) {
                const org = await createOrganization().save()
                organizations.push(org)
                roleList.push(await createRole('role ' + i, org).save())
                schools.push(await createSchool(org).save())
            }
            usersList = await User.save(createUsers(10))
            // add organizations and schools to users

            await connection.manager.save(
                usersList.flatMap((user) => {
                    const entities = []
                    for (let i = 0; i < 2; i++) {
                        const role = roleList[i]
                        entities.push(
                            createOrganizationMembership({
                                user,
                                organization: organizations[i],
                                roles: [role],
                            }),
                            createSchoolMembership({
                                user,
                                school: schools[i],
                                roles: [role],
                            })
                        )
                    }
                    return entities
                })
            )
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))
        })

        it('should get the next few records according to pagesize and startcursor', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({
                    user_id: usersList[3].user_id,
                }),
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() }
            )

            expect(usersConnection?.totalCount).to.eql(10)
            expect(usersConnection?.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(usersConnection?.edges[i].node.id).to.equal(
                    usersList[4 + i].user_id
                )
                expect(
                    usersConnection?.edges[i].node.organizations.length
                ).to.equal(2)
                expect(usersConnection?.edges[i].node.schools.length).to.equal(
                    2
                )
                expect(usersConnection?.edges[i].node.roles.length).to.equal(4)
            }
            expect(usersConnection?.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[4].user_id })
            )
            expect(usersConnection?.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[6].user_id })
            )
            expect(usersConnection?.pageInfo.hasNextPage).to.be.true
            expect(usersConnection?.pageInfo.hasPreviousPage).to.be.true
        })
    })

    context('organization filter', () => {
        let org: Organization
        let school1: School
        let role1: Role
        beforeEach(async () => {
            //org used to filter
            org = createOrganization()
            role1 = createRole('role 1', org)
            school1 = createSchool(org)

            // org and school whose membership shouldnt be included
            const org2 = createOrganization()
            const role2 = createRole('role 2', org2)
            const school2 = createSchool(org2)

            await Organization.save([org, org2])
            await Role.save([role1, role2])
            await School.save([school1, school2])

            usersList = await User.save(createUsers(10))
            await connection.manager.save(usersList)
            await connection.manager.save(
                usersList.flatMap((user) => {
                    return [
                        createOrganizationMembership({
                            user,
                            organization: org,
                            roles: [role1],
                        }),
                        createOrganizationMembership({
                            user,
                            organization: org2,
                            roles: [role2],
                        }),
                        createSchoolMembership({
                            user,
                            school: school1,
                            roles: [role1],
                        }),
                        createSchoolMembership({
                            user,
                            school: school2,
                            roles: [role2],
                        }),
                    ]
                })
            )
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))
        })
        it('should filter the pagination results on organizationId', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({
                    user_id: usersList[3].user_id,
                }),
            }
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: org.organization_id,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(10)
            expect(usersConnection?.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(usersConnection?.edges[i].node.id).to.equal(
                    usersList[4 + i].user_id
                )
                expect(
                    usersConnection?.edges[i].node.organizations.length
                ).to.equal(1)
                expect(
                    usersConnection?.edges[i].node.organizations[0].id
                ).to.equal(org.organization_id)
                expect(usersConnection?.edges[i].node.schools.length).to.equal(
                    1
                )
                expect(usersConnection?.edges[i].node.roles.length).to.equal(2)
                expect(usersConnection?.edges[i].node.schools[0].id).to.equal(
                    school1.school_id
                )
                expect(usersConnection?.edges[i].node.roles[0].id).to.equal(
                    role1.role_id
                )
            }
            expect(usersConnection?.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[4].user_id })
            )
            expect(usersConnection?.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[6].user_id })
            )
            expect(usersConnection?.pageInfo.hasNextPage).to.be.true
            expect(usersConnection?.pageInfo.hasPreviousPage).to.be.true
        })

        it('returns roles if the user has no school memberships', async () => {
            const newUser = createUser()
            await connection.manager.save([newUser])

            await createOrganizationMembership({
                user: newUser,
                organization: org,
                roles: [role1],
            }).save()

            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: org.organization_id,
                },
                userId: {
                    operator: 'eq',
                    value: newUser.user_id,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 1 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(usersConnection?.edges[0].node.roles.length).to.equal(1)
        })
    })

    context('school filter', () => {
        let org: Organization
        let school1: School
        let school2: School
        let role1: Role
        beforeEach(async () => {
            //org used to filter
            const superAdmin = await createAdminUser(testClient)
            org = await createOrganization(superAdmin).save()
            role1 = await createRole('role 1', org).save()
            school1 = createSchool(org)
            school2 = createSchool(org)

            await connection.manager.save([school1, school2])

            usersList = await User.save(createUsers(10))
            //sort users by userId
            await connection.manager.save(usersList)
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

            const memberships = await OrganizationMembership.save(
                usersList.map((user) =>
                    createOrganizationMembership({
                        user,
                        organization: org,
                    })
                )
            )
            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role1)
                .add(memberships)

            // add half of users to one school and other half to different school
            // also add 5th user to both school
            await SchoolMembership.save(
                usersList
                    .slice(0, 6)
                    .map((user) =>
                        createSchoolMembership({ user, school: school1 })
                    )
            )
            await SchoolMembership.save(
                usersList
                    .slice(5)
                    .map((user) =>
                        createSchoolMembership({ user, school: school2 })
                    )
            )
        })
        it('should filter the pagination results on schoolId', async () => {
            const directionArgs = {
                count: 3,
            }
            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'eq',
                    value: school2.school_id,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(5)
            expect(usersConnection?.edges.length).to.equal(3)

            //user belonging to more than one returned
            //FE needs all a users schools even if they are not in the filter
            expect(usersConnection?.edges[0].node.schools.length).to.equal(2)
            expect(usersConnection?.edges[0].node.id).to.equal(
                usersList[5].user_id
            )

            for (let i = 1; i < 3; i++) {
                expect(usersConnection?.edges[i].node.id).to.equal(
                    usersList[5 + i].user_id
                )
                expect(usersConnection?.edges[i].node.schools.length).to.equal(
                    1
                )
                expect(usersConnection?.edges[i].node.schools[0].id).to.equal(
                    school2.school_id
                )
            }
            expect(usersConnection?.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[5].user_id })
            )
            expect(usersConnection?.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[7].user_id })
            )
            expect(usersConnection?.pageInfo.hasNextPage).to.be.true
            expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
        })
        it('works for non-admins', async () => {
            const nonAdmin = await createNonAdminUser(testClient)
            const membership = await createOrganizationMembership({
                user: nonAdmin,
                organization: org,
                roles: [role1],
            }).save()

            await grantPermission(
                testClient,
                role1.role_id,
                PermissionName.view_users_40110,
                { authorization: getAdminAuthToken() }
            )

            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'eq',
                    value: school2.school_id,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: getNonAdminAuthToken() },
                filter
            )
            expect(usersConnection?.totalCount).to.eql(5)
        })
        it('supports the exclusive filter via IS NULL', async () => {
            await createUser().save()

            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'isNull',
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(usersConnection.totalCount).to.eql(2) // new user + super admin
        })
    })

    context('role filter', () => {
        let org: Organization
        let school1: School
        let role1: Role
        let role2: Role
        beforeEach(async () => {
            //org used to filter
            org = await createOrganization().save()
            role1 = createRole('role 1', org)
            role2 = createRole('role 2', org)
            await Role.save([role1, role2])
            school1 = await createSchool(org).save()

            usersList = await User.save(createUsers(10))

            //sort users by userId
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

            const orgMemberships = await OrganizationMembership.save(
                usersList.map((user) =>
                    createOrganizationMembership({
                        user,
                        organization: org,
                    })
                )
            )

            const schoolMemberships = await SchoolMembership.save(
                usersList.map((user) =>
                    createSchoolMembership({ user, school: school1 })
                )
            )

            // add 5 users to role1 and 5 users to role2
            // add 6th user to both roles
            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role1)
                .add(orgMemberships.slice(0, 6))
            await Role.createQueryBuilder()
                .relation('schoolMemberships')
                .of(role1)
                .add(schoolMemberships.slice(0, 6))

            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role2)
                .add(orgMemberships.slice(5))
            await Role.createQueryBuilder()
                .relation('schoolMemberships')
                .of(role2)
                .add(schoolMemberships.slice(5))
        })
        it('should filter the pagination results on roleId', async () => {
            const directionArgs = {
                count: 3,
            }
            const filter: IEntityFilter = {
                roleId: {
                    operator: 'eq',
                    value: role2.role_id,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(5)
            expect(usersConnection?.edges.length).to.equal(3)
            // We are filtering on users by roles not what roles the users that we find have

            for (let i = 0; i < 3; i++) {
                expect(usersConnection?.edges[i].node.id).to.equal(
                    usersList[5 + i].user_id
                )
            }
            expect(usersConnection?.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[5].user_id })
            )
            expect(usersConnection?.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[7].user_id })
            )
            expect(usersConnection?.pageInfo.hasNextPage).to.be.true
            expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
        })
    })

    context('organizationUserStatus filter', () => {
        let org: Organization
        let school1: School
        let role1: Role
        beforeEach(async () => {
            //org used to filter
            org = await createOrganization().save()
            role1 = await createRole('role 1', org).save()
            school1 = await createSchool(org).save()

            usersList = await User.save(createUsers(10))
            //sort users by userId
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

            const orgMemberships = usersList.map((user) =>
                createOrganizationMembership({
                    user,
                    organization: org,
                })
            )
            //set 4 users to inactive
            orgMemberships
                .slice(0, 4)
                .forEach((membership) => (membership.status = Status.INACTIVE))
            await OrganizationMembership.save(orgMemberships)
            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role1)
                .add(orgMemberships)

            const schoolMemberships = await SchoolMembership.save(
                usersList.map((user) =>
                    createSchoolMembership({
                        user,
                        school: school1,
                    })
                )
            )
            await Role.createQueryBuilder()
                .relation('schoolMemberships')
                .of(role1)
                .add(schoolMemberships)
        })

        it('should filter the pagination results on organizationId', async () => {
            const directionArgs = {
                count: 3,
            }
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: org.organization_id,
                },
                organizationUserStatus: {
                    operator: 'eq',
                    value: Status.INACTIVE,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(4)
            expect(usersConnection?.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(
                    usersConnection?.edges[i].node.organizations[0].userStatus
                ).to.equal(Status.INACTIVE)
            }
        })

        it('returns nothing for non admins', async () => {
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: org.organization_id,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                undefined,
                { authorization: getNonAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(0)
        })
    })

    context('filter combinations', () => {
        let org: Organization
        let org2: Organization
        let school1: School
        let school2: School
        let school3: School
        let role1: Role
        let role2: Role
        let role3: Role
        beforeEach(async () => {
            //org role and school used to filter
            org = await createOrganization().save()
            role1 = createRole('role 1', org)
            role2 = createRole('role 2', org)
            await Role.save([role1, role2])
            school1 = createSchool(org)
            school2 = createSchool(org)
            await School.save([school1, school2])

            usersList = await User.save(createUsers(15))
            //sort users by userId
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

            const orgMemberships = await OrganizationMembership.save(
                usersList.slice(0, 10).map((user) =>
                    createOrganizationMembership({
                        user,
                        organization: org,
                    })
                )
            )

            // add 5 users to role1/school1 and 5 users to role2/school2
            // add 6th user to both roles and schools
            const schoolMemberships = await SchoolMembership.save(
                usersList
                    .slice(0, 6)
                    .map((user) =>
                        createSchoolMembership({
                            user,
                            school: school1,
                        })
                    )
                    .concat(
                        usersList.slice(5, 10).map((user) =>
                            createSchoolMembership({
                                user,
                                school: school2,
                            })
                        )
                    )
            )

            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role1)
                .add(orgMemberships.slice(0, 6))

            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role2)
                .add(orgMemberships.slice(5))

            await Role.createQueryBuilder()
                .relation('schoolMemberships')
                .of(role1)
                .add(schoolMemberships.slice(0, 6))
            await Role.createQueryBuilder()
                .relation('schoolMemberships')
                .of(role2)
                .add(schoolMemberships.slice(5))

            // create second org and add other users to this org
            const otherUsers = usersList.slice(10)
            org2 = await createOrganization().save()
            role3 = await createRole('role 3', org2).save()
            school3 = await createSchool(org2).save()

            const otherOrgMemberships = await OrganizationMembership.save(
                otherUsers.map((user) =>
                    createOrganizationMembership({
                        user,
                        organization: org2,
                    })
                )
            )

            // add remaining users to school3 and role3
            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role3)
                .add(otherOrgMemberships)

            const otherSchoolMemberships = await SchoolMembership.save(
                otherUsers.map((user) =>
                    createSchoolMembership({ user, school: school3 })
                )
            )
            await Role.createQueryBuilder()
                .relation('schoolMemberships')
                .of(role3)
                .add(otherSchoolMemberships)
        })
        it('should filter the pagination results on all filters', async () => {
            const directionArgs = {
                count: 3,
            }
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: org.organization_id,
                },
                roleId: {
                    operator: 'eq',
                    value: role2.role_id,
                },
                schoolId: {
                    operator: 'eq',
                    value: school2.school_id,
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(5)
            expect(usersConnection?.edges.length).to.equal(3)

            for (let i = 0; i < 3; i++) {
                expect(usersConnection?.edges[i].node.id).to.equal(
                    usersList[5 + i].user_id
                )
            }
            expect(usersConnection?.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[5].user_id })
            )
            expect(usersConnection?.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[7].user_id })
            )
            expect(usersConnection?.pageInfo.hasNextPage).to.be.true
            expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
        })
    })

    context('userId filter', () => {
        beforeEach(async () => {
            usersList = await User.save(createUsers(3))
        })

        it('supports `eq` operator', async () => {
            const usersConnectionResponse = await usersConnectionNodes(
                testClient,
                { authorization: getAdminAuthToken() },
                { userId: { operator: 'eq', value: usersList[0].user_id } }
            )

            expect(
                usersConnectionResponse.edges.map((edge) => edge.node)
            ).to.deep.equal([mapUserToUserConnectionNode(usersList[0])])
        })

        it('supports `neq` operator', async () => {
            const usersConnectionResponse = await usersConnectionNodes(
                testClient,
                { authorization: getAdminAuthToken() },
                { userId: { operator: 'neq', value: usersList[0].user_id } }
            )

            expect(
                usersConnectionResponse.edges.map((edge) => edge.node)
            ).to.deep.equalInAnyOrder(
                usersList.slice(1).map(mapUserToUserConnectionNode)
            )
        })
    })

    context('phoneFilter', () => {
        beforeEach(async () => {
            usersList = []

            // create 5 users
            for (let i = 0; i < 5; i++) {
                const user = createUser()
                user.phone = '000000000'
                usersList.push(user)
            }

            await connection.manager.save(usersList)

            //sort users by userId
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

            // This test would occasionally fail if Users in the outer scope were created with
            // a phone containing '123' (from faker.phone.phoneNumber() in createUser)
            await User.update({ phone: Like('%123%') }, { phone: '+44999111' })

            // add phone number to 2 users
            usersList[0].phone = '123456789'
            usersList[1].phone = '456789123'
            await connection.manager.save(usersList.slice(0, 2))
        })
        it('should filter on phone', async () => {
            const filter: IEntityFilter = {
                phone: {
                    operator: 'contains',
                    caseInsensitive: true,
                    value: '123',
                },
            }
            const directionArgs = {
                count: 3,
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(usersConnection?.totalCount).to.eql(2)
            expect(usersConnection?.edges.length).to.equal(2)
            expect(usersConnection?.edges[0].node.id).to.equal(
                usersList[0].user_id
            )
            expect(usersConnection?.edges[1].node.id).to.equal(
                usersList[1].user_id
            )

            expect(usersConnection?.pageInfo.hasNextPage).to.be.false
            expect(usersConnection?.pageInfo.hasPreviousPage).to.be.false
        })
    })

    context('class filter', () => {
        let org: Organization
        let school: School
        let class1: Class
        let class2: Class
        let role1: Role

        beforeEach(async () => {
            //org used to filter
            const superAdmin = await createAdminUser(testClient)
            org = await createOrganization(superAdmin).save()
            role1 = await createRole('role 1', org).save()
            school = await createSchool(org).save()

            class1 = createClass([school])
            class2 = createClass([school])

            await Class.save([class1, class2])

            usersList = await User.save(createUsers(10))
            //sort users by userId
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

            const memberships = await OrganizationMembership.save(
                usersList.map((user) =>
                    createOrganizationMembership({
                        user,
                        organization: org,
                    })
                )
            )
            await Role.createQueryBuilder()
                .relation('memberships')
                .of(role1)
                .add(memberships)

            // add half of users to one class and other half to different class
            // also add 5th user to both classes
            await Class.createQueryBuilder()
                .relation('students')
                .of(class1)
                .add(usersList.slice(0, 6))

            await Class.createQueryBuilder()
                .relation('students')
                .of(class2)
                .add(usersList.slice(5))
        })

        it('should filter the pagination results on classId', async () => {
            const directionArgs = {
                count: 5,
            }

            const filter: IEntityFilter = {
                classId: {
                    operator: 'eq',
                    value: class2.class_id,
                },
            }

            const usersConnection = await userConnection(
                testClient,
                direction,
                directionArgs,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(5)
            expect(usersConnection?.edges.length).to.equal(5)

            expect(usersConnection?.edges[0].node.id).to.equal(
                usersList[5].user_id
            )

            for (let i = 1; i < 3; i++) {
                expect(usersConnection?.edges[i].node.id).to.equal(
                    usersList[5 + i].user_id
                )
            }

            const userIds = usersConnection?.edges.map((edge) => {
                return edge.node.id
            })

            const DBClass = await connection.manager.findOne(Class, {
                where: { class_id: class2.class_id },
            })

            const classUserIds =
                (await DBClass?.students)?.map((student) => {
                    return student.user_id
                }) || []

            expect(userIds).to.deep.equalInAnyOrder(classUserIds)
        })

        it('works for non-admins', async () => {
            const nonAdmin = await createNonAdminUser(testClient)
            await addOrganizationToUserAndValidate(
                testClient,
                nonAdmin.user_id,
                org.organization_id,
                getAdminAuthToken()
            )

            await grantPermission(
                testClient,
                role1.role_id,
                PermissionName.view_users_40110,
                { authorization: getAdminAuthToken() }
            )

            await addRoleToOrganizationMembership(
                testClient,
                nonAdmin.user_id,
                org.organization_id,
                role1.role_id,
                { authorization: getAdminAuthToken() }
            )

            const filter: IEntityFilter = {
                classId: {
                    operator: 'eq',
                    value: class2.class_id,
                },
            }

            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 5 },
                { authorization: getNonAdminAuthToken() },
                filter
            )

            expect(usersConnection?.totalCount).to.eql(5)

            const userIds = usersConnection?.edges.map((edge) => {
                return edge.node.id
            })

            const DBClass = await connection.manager.findOne(Class, {
                where: { class_id: class2.class_id },
            })

            const classUserIds =
                (await DBClass?.students)?.map((student) => {
                    return student.user_id
                }) || []

            expect(userIds).to.deep.equalInAnyOrder(classUserIds)
        })
        it('supports the exclusive filter via IS NULL', async () => {
            await createUser().save()

            const filter: IEntityFilter = {
                classId: {
                    operator: 'isNull',
                },
            }
            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(usersConnection.totalCount).to.eql(2) // new user + super admin
        })
    })

    context('gradeId filter', () => {
        let class1Grade: Grade
        let class2Grade: Grade
        let class1Users: User[]
        let class2Users: User[]
        beforeEach(async () => {
            class1Grade = await createGrade().save()
            class2Grade = await createGrade().save()
            class1Users = createUsers(6)
            class2Users = createUsers(6)
            await User.save([...class1Users, ...class2Users])
            const class1 = createClass(undefined, undefined, {
                students: class1Users.slice(0, 3),
                teachers: class1Users.slice(3),
            })
            const class2 = createClass(undefined, undefined, {
                students: class2Users.slice(0, 3),
                teachers: class2Users.slice(3),
            })
            class1.grades = Promise.resolve([class1Grade])
            class2.grades = Promise.resolve([class2Grade])
            await Class.save([class1, class2])
        })

        it('supports `eq` operator', async () => {
            const usersConnectionResponse = await usersConnectionNodes(
                testClient,
                { authorization: getAdminAuthToken() },
                { gradeId: { operator: 'eq', value: class1Grade.id } }
            )
            expect(
                usersConnectionResponse.edges.map((edge) => edge.node.id)
            ).to.have.same.members(class1Users.map((user) => user.user_id))
        })

        it('supports `neq` operator', async () => {
            const usersConnectionResponse = await usersConnectionNodes(
                testClient,
                { authorization: getAdminAuthToken() },
                { gradeId: { operator: 'neq', value: class1Grade.id } }
            )
            expect(
                usersConnectionResponse.edges.map((edge) => edge.node.id)
            ).to.have.same.members(class2Users.map((user) => user.user_id))
        })
    })

    context('sorting', () => {
        it('sorts by givenName', async () => {
            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: getAdminAuthToken() },
                undefined,
                {
                    field: 'givenName',
                    order: 'ASC',
                }
            )

            const usersOrderedByGivenNameAsc = [...usersList].sort((a, b) =>
                a.given_name!.localeCompare(b.given_name!)
            )

            for (let i = 0; i < usersConnection.edges.length; i++) {
                expect(usersConnection.edges[i].node.givenName).to.eq(
                    usersOrderedByGivenNameAsc[i].given_name
                )
            }
        })

        it('sorts by familyName', async () => {
            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: getAdminAuthToken() },
                undefined,
                {
                    field: 'familyName',
                    order: 'DESC',
                }
            )

            const usersOrderedByFamilyNameDesc = [...usersList].sort((a, b) =>
                b.family_name!.localeCompare(a.family_name!)
            )

            for (let i = 0; i < usersConnection.edges.length; i++) {
                expect(usersConnection.edges[i].node.familyName).to.eq(
                    usersOrderedByFamilyNameDesc[i].family_name
                )
            }
        })
        it('works with filtering', async () => {
            const usersOrderedByGivenNameAsc = [...usersList].sort((a, b) =>
                a.given_name!.localeCompare(b.given_name!)
            )
            const filter: IEntityFilter = {
                givenName: {
                    operator: 'neq',
                    value: usersOrderedByGivenNameAsc[0].given_name!,
                },
            }

            const usersConnection = await userConnection(
                testClient,
                direction,
                { count: 3 },
                { authorization: getAdminAuthToken() },
                filter,
                {
                    field: 'givenName',
                    order: 'ASC',
                }
            )

            for (let i = 0; i < usersConnection.edges.length; i++) {
                expect(usersConnection.edges[i].node.givenName).to.eq(
                    usersOrderedByGivenNameAsc[i + 1].given_name
                )
            }
        })
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({
                    user_id: usersList[3].user_id,
                }),
            }

            await usersConnectionMainData(
                testClient,
                direction,
                directionArgs,
                false,
                {
                    authorization: getAdminAuthToken(),
                }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('child connections', () => {
        let organization: Organization
        let users: User[]

        beforeEach(async () => {
            organization = await createOrganization().save()
            users = await User.save(createUsers(9))
            for (const user of users) {
                await createOrganizationMembership({
                    user,
                    organization,
                }).save()
            }
        })

        async function getUsers(
            token = getAdminAuthToken(),
            filter?: IEntityFilter
        ) {
            return userConnection(
                testClient,
                direction,
                { count: 20 },
                { authorization: token },
                filter
            )
        }
        context('organizationMembershipsConnection', () => {
            it('returns org memberships per user', async () => {
                const result = await getUsers()
                expect(result.edges).to.have.lengthOf(users.length)
                for (const edge of result.edges) {
                    const memberships = edge.node
                        .organizationMembershipsConnection!
                    expect(memberships.totalCount).to.eq(1)
                    expect(memberships.edges[0].node.organizationId).to.eq(
                        organization.organization_id
                    )
                }
            })
            it('uses isAdmin scope for permissions', async () => {
                // create a non-admin user and add to org
                const nonAdmin = await createNonAdminUser(testClient)
                const role = await createRole('role', organization, {
                    permissions: [PermissionName.view_users_40110],
                }).save()
                await createOrganizationMembership({
                    user: nonAdmin,
                    organization,
                    roles: [role],
                }).save()

                // add one user to another org
                const otherOrg = await createOrganization().save()
                const userWithTwoOrgs = users[0]
                await createOrganizationMembership({
                    user: userWithTwoOrgs,
                    organization: otherOrg,
                }).save()

                // can't see other org memberships
                let result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: userWithTwoOrgs.user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                let memberships = result.edges[0].node
                    .organizationMembershipsConnection!
                expect(memberships.totalCount).to.eq(1)

                // can see the other org membership if they are part of that org with permissions
                const otherOrgRole = await createRole('role', organization, {
                    permissions: [PermissionName.view_users_40110],
                }).save()
                await createOrganizationMembership({
                    user: nonAdmin,
                    organization: otherOrg,
                    roles: [otherOrgRole],
                }).save()

                result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: userWithTwoOrgs.user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                memberships = result.edges[0].node
                    .organizationMembershipsConnection!
                expect(memberships.totalCount).to.eq(2)
            })
        })
        context('schoolMembershipsConnection', () => {
            let school: School
            beforeEach(async () => {
                school = await createSchool(organization).save()
                for (const user of users) {
                    await createSchoolMembership({
                        user,
                        school,
                    }).save()
                }
            })
            it('returns school memberships per user', async () => {
                const result = await getUsers()
                expect(result.edges).to.have.lengthOf(users.length)
                for (const edge of result.edges) {
                    const memberships = edge.node.schoolMembershipsConnection!
                    expect(memberships.totalCount).to.eq(1)
                    expect(memberships.edges[0].node.schoolId).to.eq(
                        school.school_id
                    )
                }
            })
            it('uses isAdmin scope for permissions', async () => {
                // create a non-admin user and add to org & school
                const nonAdmin = await createNonAdminUser(testClient)
                const role = await createRole('role', organization, {
                    permissions: [
                        PermissionName.view_users_40110,
                        PermissionName.view_my_school_20119,
                    ],
                }).save()
                await createOrganizationMembership({
                    user: nonAdmin,
                    organization,
                    roles: [role],
                }).save()
                await createSchoolMembership({
                    user: nonAdmin,
                    school,
                }).save()

                // add one user to another school in another org
                const otherOrg = await createOrganization().save()
                const otherSchool = await createSchool(otherOrg).save()
                const userWithTwoSchools = users[0]
                await createSchoolMembership({
                    user: userWithTwoSchools,
                    school: otherSchool,
                }).save()

                // cant see the other school memberships
                let result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: userWithTwoSchools.user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                let memberships = result.edges[0].node
                    .schoolMembershipsConnection!
                expect(memberships.totalCount).to.eq(1)

                // can see other school membership if they are part of that school and org with permissions
                const otherOrgRole = await createRole('role', organization, {
                    permissions: [
                        PermissionName.view_users_40110,
                        PermissionName.view_my_school_20119,
                    ],
                }).save()
                await createOrganizationMembership({
                    user: nonAdmin,
                    organization: otherOrg,
                    roles: [otherOrgRole],
                }).save()
                await createSchoolMembership({
                    user: nonAdmin,
                    school: otherSchool,
                }).save()

                result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: userWithTwoSchools.user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                memberships = result.edges[0].node.schoolMembershipsConnection!
                expect(memberships.totalCount).to.eq(2)
            })
        })
        context('classesStudyingConnection', () => {
            let _class: Class
            beforeEach(async () => {
                _class = await createClass([], organization).save()
                _class.students = Promise.resolve(users)
                await _class.save()
            })
            it('returns classes studying per user', async () => {
                const result = await getUsers()
                expect(result.edges).to.have.lengthOf(users.length)
                for (const edge of result.edges) {
                    const classes = edge.node.classesStudyingConnection!
                    expect(classes.totalCount).to.eq(1)
                    expect(classes.edges[0].node.id).to.eq(_class.class_id)
                }
            })
            it('uses isAdmin scope for permissions', async () => {
                // can't see any classes without permissions
                // create a non-admin user and add to org & school
                const nonAdmin = await createNonAdminUser(testClient)
                let role = await createRole('role', organization, {
                    permissions: [PermissionName.view_users_40110],
                }).save()
                const orgMembership = await createOrganizationMembership({
                    user: nonAdmin,
                    organization,
                    roles: [role],
                }).save()

                let result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: users[0].user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                let classes = result.edges[0].node.classesStudyingConnection!
                expect(classes.totalCount).to.eq(0)

                role = await createRole('role', organization, {
                    permissions: [
                        PermissionName.view_users_40110,
                        PermissionName.view_classes_20114,
                    ],
                }).save()
                orgMembership.roles = Promise.resolve([role])
                await orgMembership.save()

                result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: users[0].user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                classes = result.edges[0].node.classesStudyingConnection!
                expect(classes.totalCount).to.eq(1)
            })
        })
        context('classesTeachingConnection', () => {
            let _class: Class
            beforeEach(async () => {
                _class = await createClass([], organization).save()
                _class.teachers = Promise.resolve(users)
                await _class.save()
            })
            it('returns classes teaching per user', async () => {
                const result = await getUsers()
                expect(result.edges).to.have.lengthOf(users.length)
                for (const edge of result.edges) {
                    const classes = edge.node.classesTeachingConnection!
                    expect(classes.totalCount).to.eq(1)
                    expect(classes.edges[0].node.id).to.eq(_class.class_id)
                }
            })
            it('uses isAdmin scope for permissions', async () => {
                // can't see any classes without permissions
                // create a non-admin user and add to org & school
                const nonAdmin = await createNonAdminUser(testClient)
                let role = await createRole('role', organization, {
                    permissions: [PermissionName.view_users_40110],
                }).save()
                const orgMembership = await createOrganizationMembership({
                    user: nonAdmin,
                    organization,
                    roles: [role],
                }).save()

                let result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: users[0].user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                let classes = result.edges[0].node.classesTeachingConnection!
                expect(classes.totalCount).to.eq(0)

                role = await createRole('role', organization, {
                    permissions: [
                        PermissionName.view_users_40110,
                        PermissionName.view_classes_20114,
                    ],
                }).save()
                orgMembership.roles = Promise.resolve([role])
                await orgMembership.save()

                result = await getUsers(getNonAdminAuthToken(), {
                    userId: {
                        operator: 'eq',
                        value: users[0].user_id,
                    },
                })
                expect(result.edges).to.have.lengthOf(1)
                classes = result.edges[0].node.classesTeachingConnection!
                expect(classes.totalCount).to.eq(1)
            })
        })
        it('dataloads child connections', async () => {
            const expectedCount = 9
            const query = `
                query {
                    usersConnection(direction:FORWARD) {            # 1
                        edges {
                            node {
                                organizationMembershipsConnection { # 2
                                    totalCount                      # 3
                                }
                                schoolMembershipsConnection {       # 4
                                    totalCount                      # 5 

                                }
                                classesStudyingConnection {         # 6
                                    totalCount                      # 7
                                }
                                classesTeachingConnection {         # 8
                                    totalCount                      # 9
                                }
                            }
                        }
                    }
                }
                `

            connection.logger.reset()
            await runQuery(query, testClient, {
                authorization: getAdminAuthToken(),
            })
            expect(connection.logger.count).to.be.eq(expectedCount)
        })
    })
})
