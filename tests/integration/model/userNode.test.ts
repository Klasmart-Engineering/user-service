import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { mapUserToUserConnectionNode } from '../../../src/pagination/usersConnection'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { UserConnectionNode } from '../../../src/types/graphQL/userConnectionNode'
import { createServer } from '../../../src/utils/createServer'
import { createClass } from '../../factories/class.factory'
import { createOrganizations } from '../../factories/organization.factory'
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
import { user2Nodes, userNode } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { expectUserConnectionNode } from '../../utils/userConnectionNode'

use(deepEqualInAnyOrder)

describe('userNode', () => {
    let aUser: User
    let user2: User
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    context('data & connection', () => {
        beforeEach(async () => {
            const newUser = createUser()
            // Populate fields not set in `createUser`
            newUser.avatar = 'some_image'
            newUser.alternate_email = faker.internet.email()
            newUser.alternate_phone = faker.phone.phoneNumber()
            aUser = await User.save(newUser)
            newUser.alternate_email = faker.internet.email()
            user2 = await User.save(newUser)
        })

        it('populates a UserConnectionNode with the requested User entity', async () => {
            const userNodeResponse = await userNode(
                testClient,
                { authorization: getAdminAuthToken() },
                aUser.user_id
            )

            expectUserConnectionNode(userNodeResponse, aUser)
        })

        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await user2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                aUser.user_id,
                user2.user_id
            )

            expect(connection.logger.count).to.be.eq(1)
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
                users.map((u, i) =>
                    createOrganizationMembership({
                        user: u,
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

            // make at least one user in a different Org have the same email as `user`
            users[8].email = user.email
            await users[8].save()
        })

        context('admin', () => {
            beforeEach(async () => {
                // Make the User an admin
                user.email = ADMIN_EMAIL
                await user.save()
            })
            it('can view all Users', async () => {
                const adminToken = generateToken(userToPayload(user))
                for (const u of users) {
                    const userNodeResponse = await userNode(
                        testClient,
                        { authorization: adminToken },
                        u.user_id
                    )

                    expect(userNodeResponse).to.exist
                }
            })
        })

        context('non-admin', () => {
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
                    const userNodeResponse = await userNode(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        users[3].user_id
                    )
                    expect(userNodeResponse).to.deep.equal(
                        mapUserToUserConnectionNode(users[3])
                    )
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
                    const userNodeResponse = await userNode(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        users[3].user_id
                    )
                    expect(userNodeResponse).to.deep.equal(
                        mapUserToUserConnectionNode(users[3])
                    )
                })
            })
            context('User with `view_my_users_40113`', () => {
                beforeEach(
                    async () =>
                        await addPermission({
                            user,
                            organization,
                            permission: PermissionName.view_my_users_40113,
                        })
                )
                it('can view Users with the same email', async () => {
                    const userNodeResponse = await userNode(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        users[8].user_id
                    )
                    expect(userNodeResponse).to.deep.equal(
                        mapUserToUserConnectionNode(users[8])
                    )
                })
            })
            context('User with no "view_*_users" permission', () => {
                it('can only see their own User', async () => {
                    const userNodeResponse = await userNode(
                        testClient,
                        {
                            authorization: generateToken(userToPayload(user)),
                        },
                        user.user_id
                    )
                    expect(userNodeResponse.id).to.deep.equal(user.user_id)
                })
            })
        })
    })
})
