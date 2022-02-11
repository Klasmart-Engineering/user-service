import faker from 'faker'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { truncateTables } from '../utils/database'

let connection: TestConnection

before(async () => {
    connection = await createTestConnection({ synchronize: true })
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
