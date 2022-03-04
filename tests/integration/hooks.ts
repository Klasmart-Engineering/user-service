import faker from 'faker'
import { createTestConnection, TestConnection } from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { truncateTables } from '../utils/database'
import TransactionalTestContext from '../utils/transactionalTestContext'

let connection: TestConnection
let transactionalContext: TransactionalTestContext
let originalAdmins: string[]

before(async () => {
    connection = await createTestConnection({ synchronize: true })
    await truncateTables(connection)
    originalAdmins = UserPermissions.ADMIN_EMAILS
    UserPermissions.ADMIN_EMAILS = ['joe@gmail.com']
    await RoleInitializer.run()
})

after(async () => {
    UserPermissions.ADMIN_EMAILS = originalAdmins
    await connection.close()
})

beforeEach(async () => {
    faker.seed(123)
    transactionalContext = new TransactionalTestContext(connection)
    await transactionalContext.start()
})

afterEach(async () => {
    await transactionalContext.finish()
})
