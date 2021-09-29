import { before } from 'mocha'
import { createTestConnection } from '../utils/testConnection'

before(async () => {
    const connection = await createTestConnection({ synchronize: true })
    await connection.close()
})
