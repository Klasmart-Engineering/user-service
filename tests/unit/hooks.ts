import { before } from 'mocha'
import { createTestConnection } from '../utils/testConnection'
import faker from 'faker'
import { runMigrations } from '../../src/initializers/migrations'

before(async () => {
    const connection = await createTestConnection()
    await runMigrations(connection)
    await connection.close()
})

beforeEach(() => {
    faker.seed(123)
})
