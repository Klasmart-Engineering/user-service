/* eslint-disable no-console */
import { use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { Role } from '../../../src/entities/role'
import { Model } from '../../../src/model'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { createServer } from '../../../src/utils/createServer'
import { createClasses } from '../../factories/class.factory'
import { createOrganizationPlus } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createUser, createUsers } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { runQuery } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { reportAverageAndErrorBars } from '../utils'

use(chaiAsPromised)

describe('class loaders benchmark', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    it('usersForClasses', async () => {
        // HISTORY
        //
        // Running on 13in 2020 MacBook Pro, 32GB memory, 2.3 GHz Quad-Core Intel Core i7:
        //  AD-2463: 455ms -> 170ms
        //  AD-2463 (with `getMany()` instead of `getRawMany()`): 454ms -> >10s
        //  AD-2463 (with `getRawMany()` + `convertRawToEntities()`): 454ms -> 335ms
        //  AD-2316: 455ms -> 520ms

        const numClasses = 100
        const numTeachersPerClass = 50
        const iterations = 10

        console.log('Starting setup...')
        console.time('setup')

        const org = await createOrganizationPlus({
            organization_name: 'org with many classes',
        }).save()

        const clientUser = await createUser({
            email: UserPermissions.ADMIN_EMAILS[0],
        }).save()
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
                const teachers = createUsers(numTeachersPerClass - 1) // there is already one teacher
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

        await reportAverageAndErrorBars(iterations, async () =>
            runQuery(query, testClient, {
                authorization: generateToken(userToPayload(clientUser)),
            })
        )
    })
})
