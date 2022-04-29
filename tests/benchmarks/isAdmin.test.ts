/* eslint-disable no-console */
import { use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { Role } from '../../src/entities/role'
import { Model } from '../../src/model'
import { createServer } from '../../src/utils/createServer'
import { createClasses } from '../factories/class.factory'
import { createOrganizationPlus } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createUser, createUsers } from '../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { runQuery } from '../utils/operations/modelOps'
import { userToPayload } from '../utils/operations/userOps'
import { generateToken } from '../utils/testConfig'
import { TestConnection } from '../utils/testConnection'

use(chaiAsPromised)

describe('isAdmin benchmarks', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    it('nonAdminUserScope for many classes', async () => {
        //
        // HISTORY
        //
        // Running on Mac M1, 8GB memory
        //

        const numClasses = 100
        const numTeachersPerClass = 50
        // AD-2305: 367ms > 1616ms
        // AD-2464: 1616ms > 691ms

        console.log('Starting setup...')
        console.time('setup')

        const org = await createOrganizationPlus({
            organization_name: 'org with many classes',
        }).save()

        const clientUser = await createUser().save()
        const teacherRole = await Role.findOneOrFail({
            where: { role_name: 'Teacher', system_role: true },
        })
        await createOrganizationMembership({
            user: clientUser,
            organization: org,
            roles: [teacherRole],
        }).save()

        const classes = createClasses(numClasses, org)
        await connection.manager.save(classes)

        await Promise.all(
            classes.map(async (c) => {
                const teachers = await createUsers(numTeachersPerClass)
                await connection.manager.save(teachers)
                c.teachers = Promise.resolve([clientUser, ...teachers])
                await c.save()
            })
        )

        console.log('Setup complete...')
        console.timeEnd('setup')

        const query = `
            query {
                organizations {
                    classes {
                        teachers {
                            user_id
                        }
                    }
                }
            }
        `

        console.log('Running query...')
        const iterations = 10
        let avg = 0
        for (let i = 0; i < iterations; i++) {
            console.time('query')
            const start = Date.now()
            // eslint-disable-next-line no-await-in-loop
            await runQuery(query, testClient, {
                authorization: generateToken(userToPayload(clientUser)),
            })
            const end = Date.now()
            avg += end - start
            console.timeEnd('query')
        }
        avg /= iterations
        console.log(`AVERAGE: ${Math.floor(avg)}ms`)
    })
})
