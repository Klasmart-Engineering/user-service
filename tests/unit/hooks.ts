import { before } from 'mocha'
import { createTestConnection } from '../utils/testConnection'
import faker, { time } from 'faker'

import { appendFileSync, unlinkSync } from 'fs'

before(async () => {
    const connection = await createTestConnection({ synchronize: true })
    await connection.close()
    unlinkSync('unit_tests_setup.txt')
})

let start: [number, number]

beforeEach(() => {
    start = process.hrtime()
    faker.seed(123)
})

afterEach(() => {
    const end = process.hrtime(start)
    appendFileSync(
        'unit_tests_setup.txt',
        Math.floor(end[0] * 1000 + end[1] / (1000 * 1000)).toString() + '\n'
    )
})
