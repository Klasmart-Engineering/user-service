import { Connection } from 'typeorm'

import { createTestConnection } from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { truncateTables } from '../utils/database'

let connection: Connection
let originalAdmins: string[]

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
    await RoleInitializer.run()
})

afterEach(async () => {
    await truncateTables(connection)
})
