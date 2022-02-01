import { Connection } from 'typeorm'
import faker from 'faker'

import { createTestConnection } from '../utils/testConnection'
import RoleInitializer from '../../src/initializers/roles'
import { truncateTables } from '../utils/database'

import fs from 'fs'

let connection: Connection

before(async () => {
    connection = await createTestConnection({
        synchronize: true,
        name: 'master',
    })
    await truncateTables(connection)
    fs.unlinkSync('acceptance_tests_setup.txt')
})

after(async () => {
    await connection?.close()
})

let start: [number, number]

beforeEach(async () => {
    start = process.hrtime()
    faker.seed(1234)
    await RoleInitializer.run()
})

afterEach(async () => {
    await truncateTables(connection)
    const end = process.hrtime(start)
    fs.appendFileSync(
        'acceptance_tests_setup.txt',
        Math.floor(end[0] * 1000 + end[1] / (1000 * 1000)).toString() + '\n'
    )
})
