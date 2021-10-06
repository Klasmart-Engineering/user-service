import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import DataLoader from 'dataloader'
import faker from 'faker'
import { pick } from 'lodash'
import { User } from '../../../src/entities/user'
import { UUIDDataLoader } from '../../../src/loaders/generic'
import { APIError } from '../../../src/types/errors/apiError'
import { createUsers } from '../../factories/user.factory'
import { truncateTables } from '../../utils/database'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'

use(chaiAsPromised)

context('loaders.generic', () => {
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    context('UUIDDataLoader', () => {
        let loader: DataLoader<string, User | APIError>
        let users: User[]

        before(async () => {
            users = await User.save(createUsers(3))
            loader = new UUIDDataLoader(User)
        })

        afterEach(async () => {
            loader.clearAll()
        })

        after(async () => {
            await truncateTables(connection, [User])
        })

        it('returns an array of the same length as the keys', async () => {
            const keys = [faker.datatype.uuid(), users[0].user_id]

            const data = await loader.loadMany(keys)

            expect(data).to.have.length(keys.length)
        })

        it('returns an array with the same order as the keys', async () => {
            // Reverse order UUIDs (which will be opposite to the default order from the DB)
            const keys = users
                .map((u) => u.user_id)
                .sort((a, b) => -a.localeCompare(b))

            const data = await loader.loadMany(keys)

            expect(data.map((u) => (u as User).user_id)).to.deep.equal(keys)
        })

        it('returns an Entity object for an existing key', async () => {
            const entity = await loader.load(users[0].user_id)

            const properties = [
                'user_id',
                'given_name',
                'family_name',
                'email',
                'phone',
            ]

            expect(pick(entity, properties)).to.deep.equal(
                pick(users[0], properties)
            )
        })

        it('returns a ERR_NON_EXISTENT_ENTITY APIError for a non-existent key', async () => {
            const key = faker.datatype.uuid()

            await expect(loader.load(key)).to.be.rejected.then((error) => {
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
                    message: `User ${key} doesn't exist.`,
                    entity: 'User',
                    variables: ['user_id'],
                    entityName: key,
                })
            })
        })
    })
})
