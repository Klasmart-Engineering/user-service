import { expect } from 'chai'
import { Connection } from 'typeorm'
import { User } from '../../src/entities/user'
import { Model } from '../../src/model'
import { createTestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import {
    getUser,
    getUsers,
    updateUser,
    createUserAndValidate,
} from '../utils/operations/modelOps'
import { createAdminUser } from '../utils/testEntities'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import faker from 'faker'
import { getAdminAuthToken } from '../utils/testConfig'

describe('model.user', () => {
    let connection: Connection
    let originalAdmins: string[]
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('newUser', () => {
        it('should create a new user', async () => {
            const user = await createAdminUser(testClient)
            expect(user).to.exist
        })
    })

    describe('setUser', () => {
        let user: User
        let modifiedUser: any

        beforeEach(async () => {
            user = await createAdminUser(testClient)
            modifiedUser = {
                user_id: user.user_id,
                given_name: faker.name.firstName(),
                family_name: faker.name.lastName(),
                email: faker.internet.email(),
                avatar: 'my new avatar',
                date_of_birth: '03-1994',
                alternate_email: 'a@a.com',
                alternate_phone: '+123456789',
            }
        })

        it('should modify an existing user', async () => {
            const gqlUser = await updateUser(testClient, modifiedUser, {
                authorization: getAdminAuthToken(),
            })
            expect(gqlUser).to.exist
            expect(gqlUser).to.include(modifiedUser)
            const dbUser = await User.findOneOrFail(user.user_id)
            expect(dbUser).to.include(gqlUser)
        })

        context('alternate_email/phone', () => {
            beforeEach(async () => {
                await connection.getRepository(User).update(user.user_id, {
                    alternate_email: faker.internet.email(),
                    alternate_phone: faker.phone.phoneNumber(),
                })
            })

            it('overwrites alternate_email/phone if NULL specified', async () => {
                const gqlUser = await updateUser(
                    testClient,
                    {
                        ...modifiedUser,
                        alternate_email: '',
                        alternate_phone: '',
                    },
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                expect(gqlUser).to.exist
                expect(gqlUser.alternate_email).to.be.null
                expect(gqlUser.alternate_phone).to.be.null
            })

            it('normalizes empty string alternate_email/phone to NULL', async () => {
                const gqlUser = await updateUser(
                    testClient,
                    {
                        ...modifiedUser,
                        alternate_email: null,
                        alternate_phone: null,
                    },
                    {
                        authorization: getAdminAuthToken(),
                    }
                )
                expect(gqlUser).to.exist
                expect(gqlUser.alternate_email).to.be.null
                expect(gqlUser.alternate_phone).to.be.null
            })

            it('overwrites existing alternate_email/phone', async () => {
                const gqlUser = await updateUser(testClient, modifiedUser, {
                    authorization: getAdminAuthToken(),
                })
                expect(gqlUser).to.exist
                expect(gqlUser.alternate_email).to.equal(
                    modifiedUser.alternate_email
                )
                expect(gqlUser.alternate_phone).to.equal(
                    modifiedUser.alternate_phone
                )
            })
        })
    })

    describe('getUsers', () => {
        let user: User

        before(async () => {
            user = await createAdminUser(testClient)
        })

        it('should get users', async () => {
            const gqlUsers = await getUsers(testClient, {
                authorization: getAdminAuthToken(),
            })

            expect(gqlUsers).to.exist
            expect(gqlUsers.length).to.equal(0)
        })
    })

    describe('getUser', () => {
        let user: User

        before(async () => {
            user = await createAdminUser(testClient)
        })

        it('should get user by ID', async () => {
            const gqlUser = await getUser(testClient, user.user_id, {
                authorization: getAdminAuthToken(),
            })
            expect(gqlUser).to.exist
            expect(user).to.include(gqlUser)
        })
    })
})
