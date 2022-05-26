import chai, { expect } from 'chai'
import faker from 'faker'
import { pick } from 'lodash'
import { Organization } from '../../../src/entities/organization'
import { User } from '../../../src/entities/user'
import { School } from '../../../src/entities/school'
import { createUser, createUsers } from '../../factories/user.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createSchool } from '../../factories/school.factory'
import {
    orgMembershipsForUsers,
    schoolMembershipsForUsers,
    UserDataLoader,
} from '../../../src/loaders/user'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { SelectQueryBuilder, createQueryBuilder, getConnection } from 'typeorm'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { createRole } from '../../factories/role.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { TestConnection } from '../../utils/testConnection'
import { createServer } from '../../../src/utils/createServer'
import { Model } from '../../../src/model'
import { generateToken } from '../../utils/testConfig'
import { userToPayload, viewUser } from '../../utils/operations/userOps'
import {
    listMemberships,
    listOwnerAndPrimaryContact,
} from '../../utils/operations/organizationOps'
import { getSchoolMembershipsViaSchool } from '../../utils/operations/schoolOps'

chai.use(deepEqualInAnyOrder)

context('User loaders', () => {
    describe('memberships', () => {
        const numUsers = 5
        let users: User[]
        let orgs: Organization[]
        beforeEach(async () => {
            users = await User.save(Array.from(Array(numUsers), createUser))
            orgs = await Organization.save(
                Array.from(Array(numUsers), createOrganization)
            )
        })

        describe('#orgMembershipsForUsers', () => {
            let orgMemberships: OrganizationMembership[][]

            beforeEach(async () => {
                // add each user to a different org
                for (let i = 0; i < numUsers; i++) {
                    await createOrganizationMembership({
                        user: users[i],
                        organization: orgs[i],
                    }).save()
                }
                orgMemberships = await orgMembershipsForUsers(
                    users.map((u) => u.user_id)
                )
            })

            it('always returns an array of equal length', async () => {
                expect(orgMemberships.length).to.eq(users.length)
            })
            it('returns all org memberships for the requested users in order', async () => {
                for (let i = 0; i < numUsers; i++) {
                    const memberships = orgMemberships[i]
                    expect(memberships.length).to.eq(1)
                    expect(memberships[0].organization_id).to.eq(
                        orgs[i].organization_id
                    )
                }
            })
        })
        describe('#schoolMembershipsForUsers', () => {
            let schoolMemberships: SchoolMembership[][]
            let schools: School[]

            beforeEach(async () => {
                schools = await School.save(
                    Array.from(Array(numUsers), (v: unknown, i: number) =>
                        createSchool(orgs[i])
                    )
                )
                // add each user to a different school
                for (let i = 0; i < numUsers; i++) {
                    await createSchoolMembership({
                        user: users[i],
                        school: schools[i],
                    }).save()
                }
                schoolMemberships = await schoolMembershipsForUsers(
                    users.map((u) => u.user_id)
                )
            })

            it('always returns an array of equal length', async () => {
                expect(schoolMemberships.length).to.eq(users.length)
            })
            it('returns all school memberships for the requested users in order', async () => {
                for (let i = 0; i < numUsers; i++) {
                    const memberships = schoolMemberships[i]
                    expect(memberships.length).to.eq(1)
                    expect(memberships[0].school_id).to.eq(schools[i].school_id)
                }
            })
        })
    })

    describe('UserDataLoader', () => {
        let loader: UserDataLoader
        let users: User[]
        let scope: SelectQueryBuilder<User>

        function extractUserOrErrorData(
            userOrNullOrError: User | null | Error
        ) {
            if (!userOrNullOrError) {
                return userOrNullOrError
            }
            if (userOrNullOrError instanceof Error) {
                return pick(userOrNullOrError, ['message'])
            }
            return pick(userOrNullOrError, [
                'user_id',
                'given_name',
                'family_name',
                'username',
                'email',
                'phone',
                'date_of_birth',
                'gender',
                'status',
            ])
        }

        beforeEach(async () => {
            users = await User.save(createUsers(3))
            scope = createQueryBuilder('user')
            loader = new UserDataLoader()
        })

        afterEach(async () => {
            loader.clearAll()
        })

        it('returns an array of the same length as the keys', async () => {
            const keys = [
                { id: users[0].user_id, scope },
                { id: users[1].user_id, scope },
                { id: faker.datatype.uuid(), scope },
            ]

            const data = await loader.loadMany(keys)
            expect(data).to.have.length(keys.length)
            expect(data.map(extractUserOrErrorData)).to.deep.equalInAnyOrder(
                [users[0], users[1], null].map(extractUserOrErrorData)
            )
        })

        it('returns an array with the same order as the keys', async () => {
            // Reverse order UUIDs (which will be opposite to the default order from the DB)
            const ids = users
                .map((u) => u.user_id)
                .sort((a, b) => -a.localeCompare(b))
            const keys = []
            for (const id of ids) {
                keys.push({ id, scope })
            }
            const data = await loader.loadMany(keys)
            const dataIds: string[] = data.map((u) => (u as User).user_id)
            expect(dataIds).to.deep.equal(keys.map((k) => k.id))
        })

        it('returns an Entity object for an existing key', async () => {
            const entity = await loader.load({
                id: users[0].user_id,
                scope: createQueryBuilder('user'),
            })

            expect(extractUserOrErrorData(entity)).to.deep.equal(
                extractUserOrErrorData(users[0])
            )
        })

        it('returns a null for a non-existent key', async () => {
            const key = faker.datatype.uuid()

            expect(
                await loader.load({
                    id: key,
                    scope: createQueryBuilder('user'),
                })
            ).to.be.a('null')
        })
    })

    describe('User visibility in UserDataLoader', () => {
        let targetedUser: User
        let orgOwner: User
        let organization: Organization
        let connection: TestConnection
        let testClient: ApolloServerTestClient
        let school: School

        before(async () => {
            connection = getConnection() as TestConnection
            const server = await createServer(new Model(connection))
            testClient = await createTestClient(server)
        })
        beforeEach(async () => {
            targetedUser = await User.save(createUser())
            orgOwner = await User.save(createUser())
            organization = await Organization.save(createOrganization(orgOwner))
            organization.primary_contact = Promise.resolve(orgOwner)
            await organization.save()
            await OrganizationMembership.save(
                createOrganizationMembership({
                    user: targetedUser,
                    organization,
                })
            )
            await OrganizationMembership.save(
                createOrganizationMembership({
                    user: orgOwner,
                    organization,
                })
            )
            school = await createSchool(organization).save()
            await createSchoolMembership({
                user: targetedUser,
                school: school,
            }).save()
        })
        context('when user has enough permissions', () => {
            let userWithPermission: User

            beforeEach(async () => {
                userWithPermission = await User.save(createUser())
                const role = await createRole('role', organization, {
                    permissions: [
                        PermissionName.view_users_40110,
                        PermissionName.view_my_school_20119,
                    ],
                }).save()
                await OrganizationMembership.save(
                    createOrganizationMembership({
                        user: userWithPermission,
                        organization,
                        roles: [role],
                    })
                )
                await createSchoolMembership({
                    user: userWithPermission,
                    school: school,
                }).save()
            })
            it('can view the nested targeted user through the organization membership resolver', async () => {
                const response = await listMemberships(
                    testClient,
                    organization.organization_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithPermission)
                        ),
                    }
                )
                expect(
                    (await response.organization.memberships[0].user)?.user_id
                ).to.equal(targetedUser.user_id)
            })
            it('can view the nested targeted user through the school membership resolver', async () => {
                const response = await getSchoolMembershipsViaSchool(
                    testClient,
                    school.school_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithPermission)
                        ),
                    }
                )
                expect((await response[0].user)?.user_id).to.equal(
                    targetedUser.user_id
                )
            })
            it('can view the nested targeted user through the user resolver', async () => {
                const response = await viewUser(
                    testClient,
                    targetedUser.user_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithPermission)
                        ),
                    }
                )
                expect(response.user_id).to.equal(targetedUser.user_id)
            })
            it('can view the nested owner and primary contact through the organization resolver', async () => {
                const response = await listOwnerAndPrimaryContact(
                    testClient,
                    organization.organization_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithPermission)
                        ),
                    }
                )
                expect(response.organization.owner.user_id).to.equal(
                    orgOwner.user_id
                )
                expect(response.organization.primary_contact.user_id).to.equal(
                    orgOwner.user_id
                )
            })
        })
        context('when user has not enough permissions', () => {
            let userWithoutPermission: User

            beforeEach(async () => {
                userWithoutPermission = await User.save(createUser())
                const role = await createRole('role', organization, {
                    permissions: [PermissionName.view_my_school_20119],
                }).save()
                await OrganizationMembership.save(
                    createOrganizationMembership({
                        user: userWithoutPermission,
                        organization,
                        roles: [role],
                    })
                )
                await createSchoolMembership({
                    user: userWithoutPermission,
                    school: school,
                }).save()
            })
            it('cannot view the nested targeted user through the organization membership resolver', async () => {
                const response = await listMemberships(
                    testClient,
                    organization.organization_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithoutPermission)
                        ),
                    }
                )
                expect(await response.organization.memberships[0].user).to.be.a(
                    'null'
                )
            })
            it('can not view the nested targeted user through the school membership resolver', async () => {
                const response = await getSchoolMembershipsViaSchool(
                    testClient,
                    school.school_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithoutPermission)
                        ),
                    }
                )
                expect(await response[0].user).to.be.a('null')
            })
            // todo: unskip when AD-2514 is resolved
            it.skip('can not view the nested targeted user through the user resolver', async () => {
                const response = await viewUser(
                    testClient,
                    targetedUser.user_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithoutPermission)
                        ),
                    }
                )
                expect(response).to.be.a('null')
            })
            it('can not view the nested owner or primary contact through the organization resolver', async () => {
                const response = await listOwnerAndPrimaryContact(
                    testClient,
                    organization.organization_id,
                    {
                        authorization: generateToken(
                            userToPayload(userWithoutPermission)
                        ),
                    }
                )
                expect(response.organization.owner).to.be.a('null')
                expect(response.organization.primary_contact).to.be.a('null')
            })
        })
    })
})
