import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import faker from 'faker'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { UserConnectionNode } from '../../../src/types/graphQL/userConnectionNode'
import { createServer } from '../../../src/utils/createServer'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { userNode } from '../../utils/operations/modelOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'

use(deepEqualInAnyOrder)

describe('userNode', () => {
    let aUser: User
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

    const expectUserConnectionEdge = (node: UserConnectionNode, u: User) => {
        expect(node).to.deep.equal({
            id: u.user_id,
            givenName: u.given_name,
            familyName: u.family_name,
            avatar: u.avatar,
            status: u.status,
            dateOfBirth: u.date_of_birth,
            gender: u.gender,
            contactInfo: {
                email: u.email,
                phone: u.phone,
            },
            alternateContactInfo: {
                email: u.alternate_email,
                phone: u.alternate_phone,
            },
        } as Required<UserConnectionNode>)
    }

    context('data & connection', () => {
        beforeEach(async () => {
            const newUser = createUser()
            // Populate fields not set in `createUser`
            newUser.avatar = 'some_image'
            newUser.alternate_email = faker.internet.email()
            newUser.alternate_phone = faker.phone.phoneNumber()
            aUser = await User.save(newUser)
        })

        it('populates a UserConnectionNode with the requested User entity', async () => {
            const userNodeResponse = await userNode(
                testClient,
                { authorization: getAdminAuthToken() },
                aUser.user_id
            )

            expectUserConnectionEdge(userNodeResponse, aUser)
        })

        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await userNode(
                testClient,
                { authorization: getAdminAuthToken() },
                aUser.user_id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })
})
