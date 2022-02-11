import faker from 'faker'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { truncateTables } from '../utils/database'

let connection: TestConnection
let originalAdmins: string[]

before(async () => {
    connection = await createTestConnection({ synchronize: true })
    await truncateTables(connection)
    originalAdmins = UserPermissions.ADMIN_EMAILS
    UserPermissions.ADMIN_EMAILS = ['joe@gmail.com']
})

after(async () => {
    UserPermissions.ADMIN_EMAILS = originalAdmins
    await connection.close()
})

beforeEach(async () => {
    faker.seed(123)
    await RoleInitializer.run()
})

afterEach(async () => {
    await truncateTables(connection)
})
