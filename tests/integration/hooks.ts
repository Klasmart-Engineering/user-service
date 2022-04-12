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
    // our timestamp DB columns tend to not use timezones, meaning:
    // https://www.postgresql.org/docs/11/datatype-datetime.html
    // "In a literal that has been determined to be timestamp without time zone, PostgreSQL will silently ignore any time zone indication. That is, the resulting value is derived from the date/time fields in the input value, and is not adjusted for time zone."
    // if you create a Date with the timezone not set to UTC then
    // it will be inserted into the DB with the value of the local time
    // when the DB is supposed to hold values in UTC
    process.env.TZ = 'UTC'
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
    connection.logger.reset()
    transactionalContext = new TransactionalTestContext(connection)
    await transactionalContext.start()
})

afterEach(async () => {
    await transactionalContext.finish()
})
