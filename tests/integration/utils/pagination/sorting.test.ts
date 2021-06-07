import chaiAsPromised from 'chai-as-promised'
import { Connection, getRepository } from 'typeorm'
import { expect, use } from 'chai'

import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createTestConnection } from '../../../utils/testConnection'
import { User } from '../../../../src/entities/user'
import { createUser } from '../../../factories/user.factory'
import {
    paginateData,
    IPaginateData,
} from '../../../../src/utils/pagination/paginate'
use(chaiAsPromised)

describe('sorting', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let usersList: User[] = []

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    context('givenName', () => {
        const orderedStrings = 'abcdefghijklmnopqrstuvwxyz'.split('')
        const numUsers = orderedStrings.length

        let args!: IPaginateData

        beforeEach(async () => {
            usersList = []
            // create 50 more users
            for (let i = 0; i < numUsers; i++) {
                const user = createUser()
                user.given_name = orderedStrings[i]
                usersList.push(user)
            }
            await connection.manager.save(usersList)
            args = {
                direction: 'FORWARD',
                directionArgs: {
                    count: 10,
                },
                scope: getRepository(User).createQueryBuilder(),
                // cursorTable,
                // cursorColumn,
                sort: {
                    defaultField: 'User.user_id',
                    aliases: {
                        givenName: 'given_name',
                    },
                    primaryField: {
                        field: 'givenName',
                        order: 'ASC',
                    },
                },
            }
        })
        context('forwards pagination', () => {
            beforeEach(() => {
                args.direction = 'FORWARD'
            })

            it('sorts ascending', async () => {
                args.sort!.primaryField!.order = 'ASC'
                const data = await paginateData(args)

                for (let i = 0; i < data.edges.length; i++) {
                    expect(data.edges[i].node.given_name).to.eq(
                        orderedStrings[i]
                    )
                }
            })

            it('sorts descending', async () => {
                args.sort!.primaryField!.order = 'DESC'
                const data = await paginateData(args)

                for (let i = 0; i < data.edges.length; i++) {
                    expect(data.edges[i].node.given_name).to.eq(
                        orderedStrings[numUsers - 1 - i]
                    )
                }
            })
        })
        context('backwards pagination', () => {
            beforeEach(() => {
                args.direction = 'BACKWARD'
            })

            it('sorts ascending', async () => {
                args.sort!.primaryField!.order = 'ASC'
                const data = await paginateData(args)
                const edgesReversed = data.edges.reverse()
                for (let i = 0; i < edgesReversed.length; i++) {
                    expect(edgesReversed[i].node.given_name).to.eq(
                        orderedStrings[numUsers - 1 - i]
                    )
                }
            })

            it('sorts descending', async () => {
                args.sort!.primaryField!.order = 'DESC'
                const data = await paginateData(args)
                const edgesReversed = data.edges.reverse()

                for (let i = 0; i < edgesReversed.length; i++) {
                    expect(edgesReversed[i].node.given_name).to.eq(
                        orderedStrings[i]
                    )
                }
            })
        })
    })

    context('joinDate', () => {})
})
