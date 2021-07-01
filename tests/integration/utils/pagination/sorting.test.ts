import chaiAsPromised from 'chai-as-promised'
import { Connection, createQueryBuilder } from 'typeorm'
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
import { createOrganization } from '../../../factories/organization.factory'
use(chaiAsPromised)

describe('sorting', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    context('strings', () => {
        const orderedStrings = 'abcdefghijklmnopqrstuvwxyz'.split('')
        const orderedStringReversed = [...orderedStrings].reverse()
        const totalUsers = orderedStrings.length
        const fetchCount = 10
        let usersList = []

        let args!: IPaginateData
        let index = 0
        let hasNextPage = true
        let hasPreviousPage = true

        beforeEach(async () => {
            usersList = []
            index = 0
            hasNextPage = true
            hasPreviousPage = true
            for (let i = 0; i < totalUsers; i++) {
                const user = createUser()
                user.given_name = orderedStrings[i]
                usersList.push(user)
            }
            await connection.manager.save(usersList)
            args = {
                direction: 'FORWARD',
                directionArgs: {
                    count: fetchCount,
                },
                scope: createQueryBuilder('user'),
                sort: {
                    primaryKey: 'user_id',
                    aliases: {
                        givenName: 'given_name',
                    },
                    sort: {
                        field: 'givenName',
                        order: 'ASC',
                    },
                },
            }
        })

        context('forwards pagination', () => {
            beforeEach(async () => {
                args.direction = 'FORWARD'
            })

            it('sorts ascending', async () => {
                args.sort!.sort!.order = 'ASC'

                while (hasNextPage) {
                    const data = await paginateData<User>(args)
                    const unseenUsers = totalUsers - index
                    expect(data.totalCount).to.eq(totalUsers)
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStrings[index]
                        )
                        index++
                    }

                    hasNextPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.endCursor
                    args.scope = createQueryBuilder('user')
                }
            })
            it('sorts descending', async () => {
                args.sort!.sort!.order = 'DESC'

                while (hasNextPage) {
                    const data = await paginateData<User>(args)
                    const unseenUsers = totalUsers - index
                    expect(data.totalCount).to.eq(totalUsers)
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStringReversed[index]
                        )
                        index++
                    }

                    hasNextPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.endCursor
                    args.scope = createQueryBuilder('user')
                }
            })
        })

        context('backwards pagination', () => {
            beforeEach(async () => {
                args.direction = 'BACKWARD'
            })

            it('sorts ascending', async () => {
                args.sort!.sort!.order = 'ASC'

                while (hasPreviousPage) {
                    const data = await paginateData<User>(args)
                    expect(data.totalCount).to.eq(totalUsers)
                    const unseenUsers = totalUsers - index
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount
                            ? unseenUsers
                            : unseenUsers % fetchCount
                            ? unseenUsers % fetchCount
                            : fetchCount
                    )

                    data.edges.reverse()

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStringReversed[index]
                        )
                        index++
                    }

                    hasPreviousPage = data.pageInfo.hasPreviousPage
                    args.directionArgs!.cursor = data.pageInfo.startCursor
                    args.scope = createQueryBuilder('user')
                }
            })

            it('sorts descending', async () => {
                args.sort!.sort!.order = 'DESC'

                while (hasPreviousPage) {
                    const data = await paginateData<User>(args)
                    expect(data.totalCount).to.eq(totalUsers)
                    const unseenUsers = totalUsers - index
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount
                            ? unseenUsers
                            : unseenUsers % fetchCount
                            ? unseenUsers % fetchCount
                            : fetchCount
                    )

                    data.edges.reverse()

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStrings[index]
                        )
                        index++
                    }

                    hasPreviousPage = data.pageInfo.hasPreviousPage
                    args.directionArgs!.cursor = data.pageInfo.startCursor
                    args.scope = createQueryBuilder('user')
                }
            })
        })
    })

    context('secondary sorting', () => {
        let args!: IPaginateData

        let userIds: string[]
        const totalUsers = 25
        const fetchCount = 10

        beforeEach(async () => {
            userIds = []
            const org = createOrganization()
            await connection.manager.save(org)
            for (let i = 0; i < totalUsers; i++) {
                const user = createUser()
                user.given_name = 'duplicate given name'

                await connection.manager.save(user)

                userIds.push(user.user_id)
            }

            userIds = userIds.sort((a, b) => a.localeCompare(b))

            args = {
                direction: 'FORWARD',
                directionArgs: {
                    count: fetchCount,
                },
                scope: createQueryBuilder('user'),
                sort: {
                    primaryKey: 'user_id',
                    aliases: {
                        givenName: 'given_name',
                    },
                    sort: {
                        field: 'givenName',
                        order: 'ASC',
                    },
                },
            }
        })
        it('uses the primary key as the secondary sort when sorting by strings', async () => {
            args.sort!.sort!.order = 'ASC'

            let hasNextPage = true
            let index = 0

            while (hasNextPage) {
                const data = await paginateData<User>(args)
                const unseenUsers = totalUsers - index
                expect(data.totalCount).to.eq(totalUsers)
                expect(data.edges.length).to.eq(
                    unseenUsers < fetchCount ? unseenUsers : fetchCount
                )

                for (let i = 0; i < data.edges.length; i++) {
                    expect(data.edges[i].node.user_id).to.eq(userIds[index])
                    index++
                }

                hasNextPage = data.pageInfo.hasNextPage
                args.directionArgs!.cursor = data.pageInfo.endCursor
                args.scope = createQueryBuilder('user')
            }
        })
    })

    context('multiple field sorting', () => {
        const orderedStrings = 'abcde'.split('')
        const orderedStrings2 = ['alpha', 'beta', 'delta', 'epsilon', 'gamma']
        const orderedStringReversed = [...orderedStrings].reverse()
        const orderedStringsReversed2 = [...orderedStrings2].reverse()
        const totalUsers = orderedStrings.length * orderedStrings2.length
        const fetchCount = 10
        let usersList = []
        let args!: IPaginateData
        let index = 0
        let hasNextPage = true
        let hasPreviousPage = true

        beforeEach(async () => {
            usersList = []
            index = 0
            hasNextPage = true
            hasPreviousPage = true

            for (let i = 0; i < totalUsers; i++) {
                const user = createUser()

                user.given_name =
                    orderedStrings[
                        Math.floor(i / (totalUsers / orderedStrings.length))
                    ]

                user.family_name =
                    orderedStrings2[
                        Math.floor(i % (totalUsers / orderedStrings2.length))
                    ]

                usersList.push(user)
            }

            await connection.manager.save(usersList)

            args = {
                direction: 'FORWARD',
                directionArgs: {
                    count: fetchCount,
                },
                scope: createQueryBuilder('user'),
                sort: {
                    primaryKey: 'user_id',
                    aliases: {
                        givenName: 'given_name',
                        familyName: 'family_name',
                    },
                    sort: {
                        field: ['familyName', 'givenName'],
                        order: 'ASC',
                    },
                },
            }
        })

        context('forwards pagination', () => {
            beforeEach(async () => {
                args.direction = 'FORWARD'
            })

            it('sorts ascending', async () => {
                args.sort!.sort!.order = 'ASC'

                while (hasNextPage) {
                    const data = await paginateData<User>(args)
                    const unseenUsers = totalUsers - index

                    expect(data.totalCount).to.eq(totalUsers)
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStrings[
                                Math.floor(
                                    index % (totalUsers / orderedStrings.length)
                                )
                            ]
                        )

                        expect(data.edges[i].node.family_name).to.eq(
                            orderedStrings2[
                                Math.floor(
                                    index /
                                        (totalUsers / orderedStrings2.length)
                                )
                            ]
                        )
                        index++
                    }

                    hasNextPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.endCursor
                    args.scope = createQueryBuilder('user')
                }
            })

            it('sorts descending', async () => {
                args.sort!.sort!.order = 'DESC'

                while (hasNextPage) {
                    const data = await paginateData<User>(args)
                    const unseenUsers = totalUsers - index
                    expect(data.totalCount).to.eq(totalUsers)
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStringReversed[
                                Math.floor(
                                    index % (totalUsers / orderedStrings.length)
                                )
                            ]
                        )

                        expect(data.edges[i].node.family_name).to.eq(
                            orderedStringsReversed2[
                                Math.floor(
                                    index /
                                        (totalUsers / orderedStrings2.length)
                                )
                            ]
                        )
                        index++
                    }

                    hasNextPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.endCursor
                    args.scope = createQueryBuilder('user')
                }
            })
        })

        context('backwards pagination', () => {
            beforeEach(async () => {
                args.direction = 'BACKWARD'
            })

            it('sorts ascending', async () => {
                args.sort!.sort!.order = 'ASC'

                while (hasPreviousPage) {
                    const data = await paginateData<User>(args)
                    expect(data.totalCount).to.eq(totalUsers)

                    const unseenUsers = totalUsers - index
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    data.edges.reverse()

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStringReversed[
                                Math.floor(
                                    index % (totalUsers / orderedStrings.length)
                                )
                            ]
                        )

                        expect(data.edges[i].node.family_name).to.eq(
                            orderedStringsReversed2[
                                Math.floor(
                                    index /
                                        (totalUsers / orderedStrings2.length)
                                )
                            ]
                        )
                        index++
                    }

                    hasPreviousPage = data.pageInfo.hasPreviousPage
                    args.directionArgs!.cursor = data.pageInfo.startCursor
                    args.scope = createQueryBuilder('user')
                }
            })

            it('sorts descending', async () => {
                args.sort!.sort!.order = 'DESC'

                while (hasPreviousPage) {
                    const data = await paginateData<User>(args)
                    expect(data.totalCount).to.eq(totalUsers)

                    const unseenUsers = totalUsers - index
                    expect(data.edges.length).to.eq(
                        unseenUsers < fetchCount ? unseenUsers : fetchCount
                    )

                    data.edges.reverse()

                    for (let i = 0; i < data.edges.length; i++) {
                        expect(data.edges[i].node.given_name).to.eq(
                            orderedStrings[
                                Math.floor(
                                    index % (totalUsers / orderedStrings.length)
                                )
                            ]
                        )

                        expect(data.edges[i].node.family_name).to.eq(
                            orderedStrings2[
                                Math.floor(
                                    index /
                                        (totalUsers / orderedStrings2.length)
                                )
                            ]
                        )
                        index++
                    }

                    hasPreviousPage = data.pageInfo.hasPreviousPage
                    args.directionArgs!.cursor = data.pageInfo.startCursor
                    args.scope = createQueryBuilder('user')
                }
            })
        })
    })
})
