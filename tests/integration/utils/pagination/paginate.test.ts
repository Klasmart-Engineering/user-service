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
    convertDataToCursor,
} from '../../../../src/utils/pagination/paginate'
import { createOrganization } from '../../../factories/organization.factory'
import { addOrganizationToUserAndValidate } from '../../../utils/operations/userOps'
import { getAdminAuthToken } from '../../../utils/testConfig'
import { Subject } from '../../../../src/entities/subject'
import { createSubject } from '../../../factories/subject.factory'
import { v4 } from 'uuid'
import {
    IEntityFilter,
    getWhereClauseFromFilter,
} from '../../../../src/utils/pagination/filtering'
import { truncateTables } from '../../../utils/database'

use(chaiAsPromised)

describe('paginate', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let usersList: User[] = []
    let scope: any
    const sortColumn = 'user_id'

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        usersList = []
        // create 10 users
        for (let i = 0; i < 10; i++) {
            usersList.push(createUser())
            await connection.manager.save(usersList)
        }
        scope = getRepository(User).createQueryBuilder()
        //sort users by userId
        usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))
    })

    context('seek forward', () => {
        const direction = 'FORWARD'
        it('should get the first few records according to pagesize', async () => {
            const directionArgs = { count: 3 }
            const data = await paginateData<User>({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })

            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(data.edges[i].node.user_id).to.equal(
                    usersList[i].user_id
                )
            }
            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[0].user_id })
            )
            expect(data.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[2].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.false
        })
        it('should get the next few records according to pagesize and startcursor', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({ user_id: usersList[3].user_id }),
            }
            const data = await paginateData<User>({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })

            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(data.edges[i].node.user_id).to.equal(
                    usersList[4 + i].user_id
                )
            }
            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[4].user_id })
            )
            expect(data.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[6].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.true
        })
        it('should get the last few records less than pagesize and startcursor', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({ user_id: usersList[7].user_id }),
            }
            const data = await paginateData<User>({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })
            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(2)
            for (let i = 0; i < 2; i++) {
                expect(data.edges[i].node.user_id).to.equal(
                    usersList[8 + i].user_id
                )
            }
            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[8].user_id })
            )
            expect(data.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[9].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.false
            expect(data.pageInfo.hasPreviousPage).to.be.true
        })
        it('handles no results appropriately', async () => {
            await truncateTables(connection, [User])
            const directionArgs = { count: 10 }
            const data = await paginateData({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })
            expect(data.totalCount).to.equal(0)
            expect(data.edges.length).to.equal(0)
        })
        it('counts items with joins correctly', async () => {
            const orgs = [createOrganization(), createOrganization()]
            await connection.manager.save(orgs)
            for (const user of usersList) {
                for (const org of orgs) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                }
            }

            scope.leftJoinAndSelect('User.memberships', 'orgMembership')

            const directionArgs = { count: 10 }
            const data = await paginateData({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })

            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(10)
            expect(data.pageInfo.hasNextPage).to.eq(false)
            expect(data.pageInfo.hasPreviousPage).to.eq(false)
        })

        context('when totalCount is not requested', () => {
            it('should not send it', async () => {
                const directionArgs = { count: 3 }
                const data = await paginateData<User>({
                    direction,
                    directionArgs,
                    scope,
                    sort: {
                        primaryKey: sortColumn,
                    },
                    includeTotalCount: false,
                })

                expect(data.totalCount).to.be.undefined
                expect(data.edges.length).to.equal(3)
            })
        })
    })

    context('seek backward', () => {
        const direction = 'BACKWARD'
        it('should get the last records according to pagesize and null cursor', async () => {
            const directionArgs = { count: 3 }
            const data = await paginateData<User>({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })
            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(10 % 3)
            expect(data.edges[0].node.user_id).to.equal(usersList[9].user_id)
            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[9].user_id })
            )
            expect(data.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[9].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.false
            expect(data.pageInfo.hasPreviousPage).to.be.true
        })
        it('should get the next few records according to pagesize and cursor', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({ user_id: usersList[9].user_id }),
            }
            const data = await paginateData<User>({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })
            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(data.edges[i].node.user_id).to.equal(
                    usersList[6 + i].user_id
                )
            }
            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[6].user_id })
            )
            expect(data.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[8].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.true
        })
        it('should get more next few records according to pagesize and cursor', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({ user_id: usersList[6].user_id }),
            }
            const data = await paginateData<User>({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })

            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(data.edges[i].node.user_id).to.equal(
                    usersList[3 + i].user_id
                )
            }
            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[3].user_id })
            )
            expect(data.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[5].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.true
        })
        it('should get the last records according to pagesize and cursor', async () => {
            const directionArgs = {
                count: 3,
                cursor: convertDataToCursor({ user_id: usersList[3].user_id }),
            }
            const data = await paginateData<User>({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })

            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(3)
            for (let i = 0; i < 3; i++) {
                expect(data.edges[i].node.user_id).to.equal(
                    usersList[i].user_id
                )
            }
            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[0].user_id })
            )
            expect(data.pageInfo.endCursor).to.equal(
                convertDataToCursor({ user_id: usersList[2].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.false
        })
        it('handles no results appropriately', async () => {
            await truncateTables(connection, [User])
            const directionArgs = { count: 10 }
            const data = await paginateData({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })
            expect(data.totalCount).to.equal(0)
            expect(data.edges.length).to.equal(0)
        })
        it('counts items with joins correctly', async () => {
            const orgs = [createOrganization(), createOrganization()]
            await connection.manager.save(orgs)
            for (const user of usersList) {
                for (const org of orgs) {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        user.user_id,
                        org.organization_id,
                        getAdminAuthToken()
                    )
                }
            }

            scope.leftJoinAndSelect('User.memberships', 'orgMembership')

            const directionArgs = { count: 10 }
            const data = await paginateData({
                direction,
                directionArgs,
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })

            expect(data.totalCount).to.eql(10)
            expect(data.edges.length).to.equal(10)
            expect(data.pageInfo.hasNextPage).to.eq(false)
            expect(data.pageInfo.hasPreviousPage).to.eq(false)
        })

        context('when totalCount is not requested', () => {
            it('should not send it', async () => {
                // when cursor is included
                let data = await paginateData<User>({
                    direction,
                    directionArgs: {
                        count: 3,
                        cursor: convertDataToCursor({
                            user_id: usersList[9].user_id,
                        }),
                    },
                    scope,
                    sort: {
                        primaryKey: sortColumn,
                    },
                    includeTotalCount: false,
                })

                expect(data.totalCount).to.be.undefined
                expect(data.edges.length).to.equal(3)

                // when no cursor is included
                data = await paginateData<User>({
                    direction,
                    directionArgs: {
                        count: 3,
                    },
                    scope,
                    sort: {
                        primaryKey: sortColumn,
                    },
                    includeTotalCount: false,
                })

                expect(data.totalCount).to.be.undefined
                expect(data.edges.length).to.equal(usersList.length % 3)
            })
        })
    })

    context('default options', () => {
        beforeEach(async () => {
            // create 50 more users
            for (let i = 0; i < 50; i++) {
                usersList.push(createUser())
                await connection.manager.save(usersList)
            }
            scope = getRepository(User).createQueryBuilder()
            //sort users by userId
            usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))
        })
        it('should paginate in forward direction with default options ', async () => {
            const data = await paginateData({
                direction: 'FORWARD',
                scope,
                sort: {
                    primaryKey: sortColumn,
                },
                includeTotalCount: true,
            })

            expect(data.totalCount).to.eql(60)
            expect(data.edges.length).to.equal(50)

            expect(data.pageInfo.startCursor).to.equal(
                convertDataToCursor({ user_id: usersList[0].user_id })
            )
            expect(data.pageInfo.hasNextPage).to.be.true
            expect(data.pageInfo.hasPreviousPage).to.be.false
        })
    })

    context('query conditions', () => {
        let subjectsList: Subject[] = []
        const ids: string[] = []

        beforeEach(async () => {
            subjectsList = []

            const names = [
                'ccc',
                'ccc',
                'ccc',
                'ddd',
                'ddd',
                'ddd',
                'eee',
                'aaa',
                'aaa',
                'aaa',
                'bbb',
                'bbb',
                'bbb',
            ]
            for (let i = 0; i < 13; i++) {
                const subject = createSubject()
                const id = v4()
                ids.push(id)
                subject.id = id
                subject.name = names[i]
                subjectsList.push(subject)
            }
            subjectsList[12].system = true
            await connection.manager.save(subjectsList)
            scope = getRepository(Subject).createQueryBuilder()

            ids.sort((a, b) => (a > b ? 1 : -1))
        })
        context('seek forward', () => {
            const direction = 'FORWARD'

            context('primary column ASC', () => {
                beforeEach(() => {
                    subjectsList.sort((a, b) =>
                        a.name! > b.name! ||
                        (a.name! === b.name! && a.id > b.id)
                            ? 1
                            : -1
                    )
                })
                it('should get the next few records according to the primary column ASC', async () => {
                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[9].id,
                            name: subjectsList[9].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'ASC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    expect(data.totalCount).to.eql(13)
                    expect(data.edges.length).to.equal(3)
                    expect(data.edges[0].node.name).to.equal('ddd')
                    expect(data.edges[1].node.name).to.equal('ddd')
                    expect(data.edges[2].node.name).to.equal('eee')
                    expect(data.pageInfo.hasNextPage).to.be.false
                    expect(data.pageInfo.hasPreviousPage).to.be.true
                })

                it('should get the next few records according to the primary key if the primary column ASC are equal', async () => {
                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[9].id,
                            name: subjectsList[9].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'ASC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    const firstId = ids.findIndex(
                        (id) => data.edges[0].node.id === id
                    )
                    const secondId = ids.findIndex(
                        (id) => data.edges[1].node.id === id
                    )

                    expect(firstId).to.be.lt(secondId)
                })

                it('should get the next few records according respecting the filtering', async () => {
                    const filter: IEntityFilter = {
                        system: {
                            operator: 'eq',
                            value: false,
                        },
                    }

                    scope.andWhere(getWhereClauseFromFilter(filter))

                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[9].id,
                            name: subjectsList[9].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'ASC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    expect(data.totalCount).to.eql(12)
                })
            })

            context('primary column DESC', () => {
                beforeEach(() => {
                    subjectsList.sort((a, b) =>
                        a.name! < b.name! ||
                        (a.name! === b.name! && a.id > b.id)
                            ? 1
                            : -1
                    )
                })
                it('should get the next few records according to the primary column DESC', async () => {
                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[9].id,
                            name: subjectsList[9].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'DESC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    expect(data.totalCount).to.eql(13)
                    expect(data.edges.length).to.equal(3)
                    expect(data.edges[0].node.name).to.equal('aaa')
                    expect(data.edges[1].node.name).to.equal('aaa')
                    expect(data.edges[2].node.name).to.equal('aaa')
                    expect(data.pageInfo.hasNextPage).to.be.false
                    expect(data.pageInfo.hasPreviousPage).to.be.true
                })

                it('should get the next few records according to the primary key if the primary column DESC are equal', async () => {
                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[9].id,
                            name: subjectsList[9].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'DESC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    const firstId = ids.findIndex(
                        (id) => data.edges[0].node.id === id
                    )
                    const secondId = ids.findIndex(
                        (id) => data.edges[1].node.id === id
                    )

                    expect(firstId).to.be.lt(secondId)
                })
            })
        })

        context('seek backward', () => {
            const direction = 'BACKWARD'

            context('primary column ASC', () => {
                beforeEach(() => {
                    subjectsList.sort((a, b) =>
                        a.name! > b.name! ||
                        (a.name! === b.name! && a.id > b.id)
                            ? 1
                            : -1
                    )
                })
                it('should get the next few records according to the primary column ASC', async () => {
                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[10].id,
                            name: subjectsList[10].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'ASC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    expect(data.totalCount).to.eql(13)
                    expect(data.edges.length).to.equal(10)
                    expect(data.edges[0].node.name).to.equal('aaa')
                    expect(data.edges[1].node.name).to.equal('aaa')
                    expect(data.edges[2].node.name).to.equal('aaa')
                    expect(data.pageInfo.hasNextPage).to.be.true
                    expect(data.pageInfo.hasPreviousPage).to.be.false
                })

                it('should get the next few records according to the primary key if the primary column ASC are equal', async () => {
                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[10].id,
                            name: subjectsList[10].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'ASC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    const firstId = ids.findIndex(
                        (id) => data.edges[0].node.id === id
                    )
                    const secondId = ids.findIndex(
                        (id) => data.edges[1].node.id === id
                    )

                    expect(firstId).to.be.lt(secondId)
                })
            })

            context('primary column DESC', () => {
                beforeEach(() => {
                    subjectsList.sort((a, b) =>
                        a.name! < b.name! ||
                        (a.name! === b.name! && a.id > b.id)
                            ? 1
                            : -1
                    )
                })
                it('should get the next few records according to the primary column DESC', async () => {
                    const directionArgs = {
                        count: 10,
                        cursor: convertDataToCursor({
                            id: subjectsList[10].id,
                            name: subjectsList[10].name,
                        }),
                    }
                    const data = await paginateData<Subject>({
                        direction,
                        directionArgs,
                        scope,
                        sort: {
                            primaryKey: 'id',
                            aliases: {
                                givenName: 'name',
                            },
                            sort: {
                                field: 'name',
                                order: 'DESC',
                            },
                        },
                        includeTotalCount: true,
                    })

                    expect(data.totalCount).to.eql(13)
                    expect(data.edges.length).to.equal(10)
                    expect(data.edges[0].node.name).to.equal('eee')
                    expect(data.edges[1].node.name).to.equal('ddd')
                    expect(data.edges[2].node.name).to.equal('ddd')
                    expect(data.pageInfo.hasNextPage).to.be.true
                    expect(data.pageInfo.hasPreviousPage).to.be.false
                })
            })
        })
    })
})
