/* eslint-disable no-console */
import { use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { Role } from '../../../src/entities/role'
import { Model } from '../../../src/model'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { createServer } from '../../../src/utils/createServer'
import { createClasses } from '../../factories/class.factory'
import {
    createOrganization,
    createOrganizationPlus,
} from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createRole } from '../../factories/role.factory'
import { createUser, createUsers } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { runQuery } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'

use(chaiAsPromised)

describe('usersConnection classesTeaching benchmark', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    it('classesTeachingConnection', async () => {
        // HISTORY
        //
        // Running on 13in 2020 MacBook Pro, 32GB memory, 2 GHz Quad-Core Intel Core i5:
        // AD-2461 (fix bug allowing teacher to see students in classes of orgs they don't have view_my_class_users_40112 in): 150ms -> 121ms

        const numClasses = 100
        const numTeachersPerClass = 50
        const iterations = 10

        console.log('Starting setup...')
        console.time('setup')

        const org = await createOrganizationPlus({
            organization_name: 'org with many classes',
        }).save()
        const anotherOrgWithUserTaughtClasses = await createOrganization().save()

        const clientUser = await createUser().save()
        const teacherRole = await Role.findOneOrFail({
            where: { role_name: 'Teacher', system_role: true },
        })
        const viewMyClassUsersRole = createRole(undefined, org, {
            permissions: [PermissionName.view_my_class_users_40112],
        })
        await createOrganizationMembership({
            user: clientUser,
            organization: org,
            roles: [teacherRole, viewMyClassUsersRole],
        }).save()
        await createOrganizationMembership({
            user: clientUser,
            organization: anotherOrgWithUserTaughtClasses,
            roles: [teacherRole, viewMyClassUsersRole],
        }).save()

        const classes = createClasses(numClasses, org)
        const classesInOtherOrg = createClasses(
            numClasses,
            anotherOrgWithUserTaughtClasses
        )
        await connection.manager.save(classes)
        await connection.manager.save(classesInOtherOrg)

        await Promise.all(
            classes.map(async (c) => {
                const teachers = createUsers(numTeachersPerClass - 1) // there is already one teacher
                await connection.manager.save(teachers)
                c.teachers = Promise.resolve([clientUser, ...teachers])
                await c.save()
            })
        )
        await Promise.all(
            classesInOtherOrg.map(async (c) => {
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
                usersConnection(direction:FORWARD){
                    edges {
                        cursor
                        node {
                            id
                            givenName
                            familyName
                            classesTeachingConnection {
                                totalCount
                                edges {
                                    node {
                                        id
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `

        console.log('Running query...')
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
