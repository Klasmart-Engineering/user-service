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
import { createOrganization } from '../../../factories/organization.factory'
import { addOrganizationToUserAndValidate } from '../../../utils/operations/userOps'
import { getAdminAuthToken } from '../../../utils/testConfig'
import { OrganizationMembership } from '../../../../src/entities/organizationMembership'
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
                sort: {
                    defaultField: 'user_id',
                    aliases: {
                        givenName: {
                            select: 'given_name',
                        },
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

    context('joinDate', () => {
        let args!: IPaginateData
        let dates: Date[] = []

        beforeEach(async () => {
            usersList = []
            dates = []
            const org = createOrganization()
            await connection.manager.save(org)
            for (let i = 0; i < 10; i++) {
                const user = createUser()
                // const date = new Date(2000 + i, 0, 1)
                const date = new Date()
                date.setFullYear(2000 + i)
                dates.push(date)
                usersList.push(user)

                await connection.manager.save(user)

                const membership = await addOrganizationToUserAndValidate(
                    testClient,
                    user.user_id,
                    org.organization_id,
                    getAdminAuthToken()
                )
                membership.join_timestamp = date
                await connection.manager.save<OrganizationMembership, any>(
                    OrganizationMembership.name,
                    membership
                )
            }

            args = {
                direction: 'FORWARD',
                directionArgs: {
                    count: 10,
                },
                scope: getRepository(User)
                    .createQueryBuilder()
                    .leftJoinAndSelect('User.memberships', 'OrgMembership'),
                sort: {
                    defaultField: 'user_id',
                    aliases: {
                        joinDate: {
                            select: 'OrgMembership.join_timestamp',
                            type: 'date',
                        },
                    },
                    primaryField: {
                        field: 'joinDate',
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
                // args.sort!.primaryField!.order = 'ASC'
                const data = await paginateData<User>(args)
                // console.log(data)
                expect(data.edges.length).to.eq(usersList.length)
                for (let i = 0; i < data.edges.length; i++) {
                    expect(
                        (
                            await data.edges[i].node.memberships
                        )?.[0].join_timestamp?.toString()
                    ).to.eq(dates[i].toString())
                }
            })

            it('sorts descending', async () => {
                args.sort!.primaryField!.order = 'DESC'

                const data = await paginateData<User>(args)
                const edgesReversed = data.edges.reverse()
                expect(data.edges.length).to.eq(usersList.length)
                for (let i = 0; i < edgesReversed.length; i++) {
                    expect(
                        (
                            await data.edges[i].node.memberships
                        )?.[0].join_timestamp?.toString()
                    ).to.eq(dates[i].toString())
                }
            })

            it('paginates', async () => {
                let data = await paginateData<User>(args)

                expect(data.totalCount).to.eq(usersList.length)
                expect(data.edges.length).to.eq(usersList.length)

                args.directionArgs!.cursor = data.edges[0].cursor
                args.scope = getRepository(User)
                    .createQueryBuilder()
                    .leftJoinAndSelect('User.memberships', 'OrgMembership')
                let data2 = await paginateData<User>(args)

                expect(data2.totalCount).to.eq(usersList.length)
                expect(data2.edges.length).to.eq(usersList.length - 1)

                args.directionArgs!.cursor = data2.edges[0].cursor
                args.scope = getRepository(User)
                    .createQueryBuilder()
                    .leftJoinAndSelect('User.memberships', 'OrgMembership')
                data = await paginateData<User>(args)

                expect(data.totalCount).to.eq(usersList.length)
                expect(data.edges.length).to.eq(usersList.length - 2)
            })
        })
    })
})
