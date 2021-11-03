import { Organization } from '../../../src/entities/organization'
import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { getRepository } from 'typeorm'
import { createOrganization } from '../../factories/organization.factory'
import { User } from '../../../src/entities/user'
import { expect } from 'chai'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { Role } from '../../../src/entities/role'
import { createRole } from '../../factories/role.factory'
import { classesConnectionQuery } from '../../../src/pagination/classesConnection'
import {
    classesConnection,
    classesConnectionWrapper,
} from '../../../src/schemas/school'

import { UserPermissions } from '../../../src/permissions/userPermissions'

import { Context } from '../../../src/main'

import { GraphQLResolveInfo } from 'graphql'
import { createSchool } from '../../factories/school.factory'
import { createClass } from '../../factories/class.factory'
import { School } from '../../../src/entities/school'
import { Class } from '../../../src/entities/class'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { Model } from '../../../src/model'
import { createAdminUser } from '../../utils/testEntities'
import { createServer } from '../../../src/utils/createServer'
import { getAdminAuthToken } from '../../utils/testConfig'

describe.only('classesChildConnection', async () => {
    let connection: TestConnection
    let loaders: IDataLoaders

    let clientUser: User
    let school1: School
    let class1: Class
    let class2: Class
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        clientUser = await createAdminUser(testClient)
        school1 = await createSchool().save()
        class1 = await createClass([school1]).save()
        class2 = await createClass([school1]).save()

        const token = { id: clientUser.user_id, email: clientUser.email }
        const permissions = new UserPermissions(token)
        loaders = createContextLazyLoaders(permissions)
    })

    context('sorting', () => {
        it('sorts by name', async () => {
            const args: IChildPaginationArgs = {
                direction: 'FORWARD',
                count: 2,
                sort: {
                    field: 'class_name',
                    order: 'ASC',
                },
            }

            const result = await loaders.classesConnectionChild.instance.load({
                args,
                includeTotalCount: false,
                parent: {
                    id: school1.school_id,
                    filterKey: 'schoolId',
                    pivot: '"School"."school_id"',
                },
            })

            const sorted = new Map([[school1, [class1, class2]]])
                .get(school1)!
                .map((classObj) => classObj.class_name)
                .sort()
                .reverse()

            expect(result.edges.map((e) => e.node.name)).deep.equal(sorted)
        })
    })

    // context('resolver', () => {
    //     let ctx: Pick<Context, 'loaders'>
    //
    //     beforeEach(() => {
    //         ctx = { loaders }
    //     })
    //
    //     it('uses exactly one dataloader when called with different users', async () => {
    //         connection.logger.reset()
    //         const loaderResults = []
    //
    //         for (const user of [clientUser, otherUser]) {
    //             const loaderResult = classesConnection(
    //                 { id: user.user_id },
    //                 {},
    //                 ctx,
    //                 false
    //             )
    //             loaderResults.push(loaderResult)
    //         }
    //
    //         await Promise.all(loaderResults)
    //         expect(connection.logger.count).to.be.eq(2)
    //     })
    //
    //     context('totalCount', async () => {
    //         let fakeInfo: any
    //
    //         beforeEach(() => {
    //             fakeInfo = {
    //                 fieldNodes: [
    //                     {
    //                         kind: 'Field',
    //                         name: {
    //                             kind: 'Name',
    //                             value: 'classesConnection',
    //                         },
    //                         selectionSet: {
    //                             kind: 'SelectionSet',
    //                             selections: [],
    //                         },
    //                     },
    //                 ],
    //             }
    //         })
    //
    //         const callResolver = (
    //             fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
    //         ) => {
    //             return classesConnectionWrapper(
    //                 { id: clientUser.user_id },
    //                 {},
    //                 ctx,
    //                 fakeInfo
    //             )
    //         }
    //
    //         it('returns total count', async () => {
    //             fakeInfo.fieldNodes[0].selectionSet?.selections.push({
    //                 kind: 'Field',
    //                 name: { kind: 'Name', value: 'totalCount' },
    //             })
    //
    //             const result = await callResolver(fakeInfo)
    //
    //             expect(result.totalCount).to.eq(
    //                 memberships.get(clientUser)!.length
    //             )
    //         })
    //
    //         it('doesnt return total count', async () => {
    //             const result = await callResolver(fakeInfo)
    //
    //             expect(result.totalCount).to.eq(undefined)
    //         })
    //     })
    // })
})