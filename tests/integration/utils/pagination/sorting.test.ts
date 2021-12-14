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
    convertDataToCursor,
} from '../../../../src/utils/pagination/paginate'
import { createOrganization } from '../../../factories/organization.factory'
import { Organization } from '../../../../src/entities/organization'
import { OrganizationOwnership } from '../../../../src/entities/organizationOwnership'
import { createOrganizationOwnership } from '../../../factories/organizationOwnership.factory'

interface OrgAndOwner extends Organization {
    __owner__: { email: string }
}

use(chaiAsPromised)

describe('sorting', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
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
                includeTotalCount: true,
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

    context('booleans', () => {
        const orderedBooleans = [false, false, false, true, true, true]
        const orderedSBooleansReversed = [...orderedBooleans].reverse()
        const totalUsers = orderedBooleans.length
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
                user.primary = orderedBooleans[i]
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
                        primary: 'primary',
                    },
                    sort: {
                        field: 'primary',
                        order: 'ASC',
                    },
                },
                includeTotalCount: true,
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
                        expect(data.edges[i].node.primary).to.eq(
                            orderedBooleans[index]
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
                        expect(data.edges[i].node.primary).to.eq(
                            orderedSBooleansReversed[index]
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
                        expect(data.edges[i].node.primary).to.eq(
                            orderedSBooleansReversed[index]
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
                        expect(data.edges[i].node.primary).to.eq(
                            orderedBooleans[index]
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
                includeTotalCount: true,
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

        it('secondary sorting order is ASC when primary sorting is DESC', async () => {
            args.sort!.sort!.order = 'DESC'

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
                includeTotalCount: true,
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
                        unseenUsers < fetchCount
                            ? unseenUsers
                            : unseenUsers % fetchCount
                            ? unseenUsers % fetchCount
                            : fetchCount
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
                        unseenUsers < fetchCount
                            ? unseenUsers
                            : unseenUsers % fetchCount
                            ? unseenUsers % fetchCount
                            : fetchCount
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

    context('joined column sorting', () => {
        const orderedEmails: string[] = Array.from(
            new Array(6),
            (_, i) => `owner${i}.gmail.com`
        )
        const orderedEmailsReversed = [...orderedEmails].reverse()
        const totalOrgs = orderedEmails.length
        const fetchCount = 2
        let index = 0
        let hasPreviousPage = true
        let hasNextPage = true
        let args!: IPaginateData
        let organizations: Organization[]
        let owners: User[]
        let organizationsReversed: Organization[]
        let ownersReversed: User[]

        beforeEach(async () => {
            index = 0
            owners = await User.save(
                Array.from(orderedEmails, (email: string) =>
                    createUser({ email })
                )
            )

            organizations = await Organization.save(
                Array.from(owners, (owner) => createOrganization(owner))
            )

            await OrganizationOwnership.save(
                Array.from(organizations, (org, i) =>
                    createOrganizationOwnership({
                        user: owners[i],
                        organization: org,
                    })
                )
            )

            organizationsReversed = [...organizations].reverse()
            ownersReversed = [...owners].reverse()

            args = {
                direction: 'FORWARD',
                directionArgs: {
                    count: fetchCount,
                },
                scope: Organization.createQueryBuilder('Organization')
                    .addSelect('owner.email')
                    .leftJoin('Organization.owner', 'owner'),
                sort: {
                    primaryKey: 'organization_id',
                    aliases: {
                        ownerEmail: 'owner.email',
                    },
                    sort: {
                        field: ['ownerEmail'],
                        order: 'ASC',
                    },
                },
                includeTotalCount: true,
            }
        })

        context('forwards pagination', () => {
            it('sorts ascending', async () => {
                while (hasNextPage) {
                    const data = await paginateData<Organization>(args)
                    const unseenOrgs = totalOrgs - index

                    expect(data.totalCount).to.eq(totalOrgs)
                    expect(data.edges.length).to.eq(
                        unseenOrgs < fetchCount ? unseenOrgs : fetchCount
                    )

                    for (let i = 0; i < data.edges.length; i++) {
                        const orgNode = data.edges[i].node as OrgAndOwner
                        const orgCursor = data.edges[i].cursor

                        expect(orgNode.__owner__.email).to.eq(
                            orderedEmails[index]
                        )

                        expect(orgCursor).to.equal(
                            convertDataToCursor({
                                organization_id:
                                    organizations[index].organization_id,
                                'owner.email': owners[index].email,
                            })
                        )

                        index++
                    }

                    hasNextPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.endCursor
                }
            })

            it('sorts descending', async () => {
                args.sort!.sort!.order = 'DESC'

                while (hasNextPage) {
                    const data = await paginateData<Organization>(args)
                    const unseenOrgs = totalOrgs - index

                    expect(data.totalCount).to.eq(totalOrgs)
                    expect(data.edges.length).to.eq(
                        unseenOrgs < fetchCount ? unseenOrgs : fetchCount
                    )

                    for (let i = 0; i < data.edges.length; i++) {
                        const orgNode = data.edges[i].node as OrgAndOwner
                        const orgCursor = data.edges[i].cursor

                        expect(orgNode.__owner__.email).to.eq(
                            orderedEmailsReversed[index]
                        )

                        expect(orgCursor).to.equal(
                            convertDataToCursor({
                                organization_id:
                                    organizationsReversed[index]
                                        .organization_id,
                                'owner.email': ownersReversed[index].email,
                            })
                        )

                        index++
                    }

                    hasNextPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.endCursor
                }
            })
        })

        context('backwards pagination', () => {
            beforeEach(() => {
                args.direction = 'BACKWARD'
            })

            it('sorts ascending', async () => {
                while (hasPreviousPage) {
                    const data = await paginateData<Organization>(args)
                    const unseenOrgs = totalOrgs - index

                    expect(data.totalCount).to.eq(totalOrgs)
                    expect(data.edges.length).to.eq(
                        unseenOrgs < fetchCount
                            ? unseenOrgs
                            : unseenOrgs % fetchCount
                            ? unseenOrgs % fetchCount
                            : fetchCount
                    )

                    data.edges.reverse()

                    for (let i = 0; i < data.edges.length; i++) {
                        const orgNode = data.edges[i].node as OrgAndOwner
                        const orgCursor = data.edges[i].cursor

                        expect(orgNode.__owner__.email).to.eq(
                            orderedEmailsReversed[index]
                        )

                        expect(orgCursor).to.equal(
                            convertDataToCursor({
                                organization_id:
                                    organizationsReversed[index]
                                        .organization_id,
                                'owner.email': ownersReversed[index].email,
                            })
                        )

                        index++
                    }

                    hasPreviousPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.startCursor
                }
            })

            it('sorts descending', async () => {
                args.sort!.sort!.order = 'DESC'

                while (hasPreviousPage) {
                    const data = await paginateData<Organization>(args)
                    const unseenOrgs = totalOrgs - index

                    data.edges.reverse()

                    expect(data.totalCount).to.eq(totalOrgs)
                    expect(data.edges.length).to.eq(
                        unseenOrgs < fetchCount
                            ? unseenOrgs
                            : unseenOrgs % fetchCount
                            ? unseenOrgs % fetchCount
                            : fetchCount
                    )

                    for (let i = 0; i < data.edges.length; i++) {
                        const orgNode = data.edges[i].node as OrgAndOwner
                        const orgCursor = data.edges[i].cursor

                        expect(orgNode.__owner__.email).to.eq(
                            orderedEmails[index]
                        )

                        expect(orgCursor).to.equal(
                            convertDataToCursor({
                                organization_id:
                                    organizations[index].organization_id,
                                'owner.email': owners[index].email,
                            })
                        )

                        index++
                    }

                    hasPreviousPage = data.pageInfo.hasNextPage
                    args.directionArgs!.cursor = data.pageInfo.startCursor
                }
            })
        })
    })
})
