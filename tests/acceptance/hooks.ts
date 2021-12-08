import { Connection } from 'typeorm'
import faker from 'faker'

import { createTestConnection } from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { truncateTables } from '../utils/database'

let connection: Connection

before(async () => {
    connection = await createTestConnection({
        synchronize: true,
        name: 'master',
    })
    await truncateTables(connection)
})

after(async () => {
    await connection?.close()
})

beforeEach(async () => {
    faker.seed(1234)
    await RoleInitializer.run()
})

afterEach(async () => {
    await truncateTables(connection)
})
