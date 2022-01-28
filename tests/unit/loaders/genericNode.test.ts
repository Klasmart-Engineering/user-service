import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import faker from 'faker'
import { pick } from 'lodash'
import { createQueryBuilder, SelectQueryBuilder } from 'typeorm'
import { User } from '../../../src/entities/user'
import { NodeDataLoader } from '../../../src/loaders/genericNode'
import {
    mapUserToUserConnectionNode,
    coreUserConnectionNodeFields,
    CoreUserConnectionNode,
} from '../../../src/pagination/usersConnection'
import { APIError } from '../../../src/types/errors/apiError'
import { createUsers } from '../../factories/user.factory'
import { truncateTables } from '../../utils/database'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'

use(chaiAsPromised)

context('loaders.genericNode', () => {
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('NodeDataLoader', () => {
        let loader: NodeDataLoader<User, CoreUserConnectionNode>
        let users: User[]
        let scope: SelectQueryBuilder<User>

        beforeEach(async () => {
            users = await User.save(createUsers(3))
            scope = createQueryBuilder('user')
            loader = new NodeDataLoader(
                User,
                'UserConnectionNode',
                mapUserToUserConnectionNode,
                coreUserConnectionNodeFields
            )
        })

        afterEach(async () => {
            loader.clearAll()
        })

        after(async () => {
            await truncateTables(connection, [User])
        })

        it('returns an array of the same length as the keys', async () => {
            const keys = [
                { id: faker.datatype.uuid(), scope },
                { id: users[0].user_id, scope },
            ]

            const data = await loader.loadMany(keys)

            expect(data).to.have.length(keys.length)
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

            expect(
                data.map((u) => (u as CoreUserConnectionNode).id)
            ).to.deep.equal(keys.map((k) => k.id))
        })

        it('returns an Entity object for an existing key', async () => {
            const entity = await loader.load({
                id: users[0].user_id,
                scope: createQueryBuilder('user'),
            })
            const properties = [
                'id',
                'givenName',
                'familyName',
                'avatar',
                'status',
                'contactInfo',
                'alternateContactInfo',
                'dateOfBirth',
                'gender',
            ]

            expect(pick(entity, properties)).to.deep.equal(
                pick(mapUserToUserConnectionNode(users[0]), properties)
            )
        })

        it('returns a ERR_NON_EXISTENT_ENTITY APIError for a non-existent key', async () => {
            const key = faker.datatype.uuid()

            await expect(
                loader.load({ id: key, scope: createQueryBuilder('user') })
            ).to.be.rejected.then((error) => {
                expect(error).to.be.instanceOf(APIError)
                expect(
                    pick(error, [
                        'code',
                        'message',
                        'entity',
                        'variables',
                        'entityName',
                    ])
                ).to.deep.equal({
                    code: 'ERR_NON_EXISTENT_ENTITY',
                    message: `UserConnectionNode ${key} doesn't exist.`,
                    entity: 'UserConnectionNode',
                    variables: ['id'],
                    entityName: key,
                })
            })
        })
    })
})
