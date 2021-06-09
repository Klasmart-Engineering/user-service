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

import faker from 'faker'
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

    let usersList: User[] = []
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
                const date = faker.date.past()
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
                        joinDate: 'OrgMembership.join_timestamp',
                    },
                    primaryField: {
                        field: 'joinDate',
                        order: 'ASC',
                    },
                },
            }

            dates = dates.sort((a, b) => a.valueOf() - b.valueOf())
        })

        context('forwards pagination', () => {
            beforeEach(() => {
                args.direction = 'FORWARD'
            })

            it('sorts ascending', async () => {
                args.sort!.primaryField!.order = 'ASC'
                const data = await paginateData<User>(args)
                expect(data.edges.length).to.eq(usersList.length)
                for (let i = 0; i < data.edges.length; i++) {
                    const joinDate = (await data.edges[i].node.memberships)?.[0]
                        .join_timestamp
                    expect(joinDate?.valueOf()).to.eq(dates[i].valueOf())
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
                        )?.[0].join_timestamp?.valueOf()
                    ).to.eq(dates[i].valueOf())
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

    context('secondary sorting', () => {
        let args!: IPaginateData
        let date: Date

        let userIds: string[]

        beforeEach(async () => {
            date = new Date()
            userIds = []
            const org = createOrganization()
            await connection.manager.save(org)
            for (let i = 0; i < 10; i++) {
                const user = createUser()
                user.given_name = 'duplicate given name'
                user.family_name = 'duplicate family name'

                await connection.manager.save(user)

                userIds.push(user.user_id)

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

            userIds = userIds.sort((a, b) => a.localeCompare(b))

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
                        joinDate: 'OrgMembership.join_timestamp',
                        givenName: 'User.given_name',
                        familyName: 'User.family_name',
                    },
                    primaryField: {
                        field: 'joinDate',
                        order: 'ASC',
                    },
                },
            }
        })
        it('uses the primary key as the secondary sort when sorting by join date', async () => {
            args.sort!.primaryField!.field = 'joinDate'
            const data = await paginateData<User>(args)

            for (let i = 0; i < data.edges.length; i++) {
                expect(data.edges[i].node.user_id).to.eq(userIds[i])
            }

            expect(data.totalCount).to.eq(userIds.length)
            expect(data.edges.length).to.eq(userIds.length)

            args.directionArgs!.cursor = data.edges[0].cursor
            args.scope = getRepository(User)
                .createQueryBuilder()
                .leftJoinAndSelect('User.memberships', 'OrgMembership')
            let data2 = await paginateData<User>(args)

            for (let i = 0; i < data2.edges.length; i++) {
                expect(data2.edges[i].node.user_id).to.eq(userIds[i + 1])
            }

            expect(data2.totalCount).to.eq(userIds.length)
            expect(data2.edges.length).to.eq(userIds.length - 1)
        })
        it('uses the primary key as the secondary sort when sorting by given name', async () => {
            args.sort!.primaryField!.field = 'givenName'
            const data = await paginateData<User>(args)

            for (let i = 0; i < data.edges.length; i++) {
                expect(data.edges[i].node.user_id).to.eq(userIds[i])
            }

            expect(data.totalCount).to.eq(userIds.length)
            expect(data.edges.length).to.eq(userIds.length)

            args.directionArgs!.cursor = data.edges[0].cursor
            args.scope = getRepository(User)
                .createQueryBuilder()
                .leftJoinAndSelect('User.memberships', 'OrgMembership')
            let data2 = await paginateData<User>(args)

            for (let i = 0; i < data2.edges.length; i++) {
                expect(data2.edges[i].node.user_id).to.eq(userIds[i + 1])
            }

            expect(data2.totalCount).to.eq(userIds.length)
            expect(data2.edges.length).to.eq(userIds.length - 1)
        })
        it('uses the primary key as the secondary sort when sorting by family name', async () => {
            args.sort!.primaryField!.field = 'familyName'
            const data = await paginateData<User>(args)

            for (let i = 0; i < data.edges.length; i++) {
                expect(data.edges[i].node.user_id).to.eq(userIds[i])
            }

            expect(data.totalCount).to.eq(userIds.length)
            expect(data.edges.length).to.eq(userIds.length)

            args.directionArgs!.cursor = data.edges[0].cursor
            args.scope = getRepository(User)
                .createQueryBuilder()
                .leftJoinAndSelect('User.memberships', 'OrgMembership')
            let data2 = await paginateData<User>(args)

            for (let i = 0; i < data2.edges.length; i++) {
                expect(data2.edges[i].node.user_id).to.eq(userIds[i + 1])
            }

            expect(data2.totalCount).to.eq(userIds.length)
            expect(data2.edges.length).to.eq(userIds.length - 1)
        })
        // it('reverses order when backwards paginating')
    })
})
