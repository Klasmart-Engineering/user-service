import { before } from 'mocha'
import { createTestConnection } from '../utils/testConnection'
import faker from 'faker'

before(async () => {
    const connection = await createTestConnection({ synchronize: true })
    await connection.close()
})

beforeEach(() => {
    faker.seed(123)
})
