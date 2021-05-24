import { expect, use } from 'chai'
import { Connection } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { createTestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { getAdminAuthToken, getNonAdminAuthToken } from '../../utils/testConfig'
import {
    getAllOrganizations,
    userConnection,
} from '../../utils/operations/modelOps'
import {
    createOrganizationAndValidate,
    addOrganizationToUserAndValidate,
    addSchoolToUser,
} from '../../utils/operations/userOps'
import { Model } from '../../../src/model'
import { User } from '../../../src/entities/user'
import { Organization } from '../../../src/entities/organization'
import chaiAsPromised from 'chai-as-promised'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import {
    grantPermission,
    revokePermission,
} from '../../utils/operations/roleOps'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { addRoleToSchoolMembership } from '../../utils/operations/schoolMembershipOps'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createUser } from '../../factories/user.factory'

use(chaiAsPromised)

describe('isAdmin', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let originalAdmins: string[]

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
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
            it('returns an empty list of organizations', async () => {
                const gqlOrgs = await getAllOrganizations(testClient, {
                    authorization: undefined,
                })

                expect(gqlOrgs).to.be.empty
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
                let role = createRole('role ' + i, org)
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
                    await addRoleToSchoolMembership(
                        testClient,
                        user.user_id,
                        schools[i].school_id,
                        roleList[i].role_id,
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
            it("only shows the logged in user if they aren't part of a school/org", async () => {
                const user = await createNonAdminUser(testClient)
                const user2 = createUser()
                user2.email = user.email
                await connection.manager.save([user2])

                let usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 10 },
                    { authorization: getNonAdminAuthToken() }
                )

                expect(usersConnection.totalCount).to.eq(1)
                expect(usersConnection.edges.length).to.eq(1)
            })
            it('requires view_my_users_40113 permission to view my users', async () => {
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

                let usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 10 },
                    { authorization: getNonAdminAuthToken() }
                )

                expect(usersConnection.totalCount).to.eq(1)
                expect(usersConnection.edges.length).to.eq(1)

                await grantPermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_my_users_40113,
                    { authorization: getAdminAuthToken() }
                )

                usersConnection = await userConnection(
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

            it('requires view_my_school_users_40111 or view_my_class_users_40112 permission to view school users', async () => {
                const user = await createNonAdminUser(testClient)
                const token = getNonAdminAuthToken()
                await addSchoolToUser(
                    testClient,
                    user.user_id,
                    schools[0].school_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    user.user_id,
                    schools[0].school_id,
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

                await revokePermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_my_school_users_40111,
                    { authorization: getAdminAuthToken() }
                )

                usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                // can view my user only
                expect(usersConnection.totalCount).to.eq(1)

                await grantPermission(
                    testClient,
                    roleList[0].role_id,
                    PermissionName.view_my_class_users_40112,
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

                let usersConnection = await userConnection(
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
                await addSchoolToUser(
                    testClient,
                    user.user_id,
                    schools[0].school_id,
                    { authorization: getAdminAuthToken() }
                )
                await addRoleToSchoolMembership(
                    testClient,
                    user.user_id,
                    schools[0].school_id,
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

                let usersConnection = await userConnection(
                    testClient,
                    direction,
                    { count: 3 },
                    { authorization: token }
                )

                expect(usersConnection.totalCount).to.eq(11)
            })
        })
    })
})
