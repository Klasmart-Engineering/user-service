import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { User } from '../../../src/entities/user'
import { expect } from 'chai'
import {
    classesChildConnection,
    classesChildConnectionResolver,
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
import { classesConnection } from '../../utils/operations/modelOps'

describe('classesChildConnection', async () => {
    let connection: TestConnection
    let loaders: IDataLoaders

    let clientUser1: User
    let clientUser2: User
    let school1: School
    let school2: School
    let class1: Class
    let class2: Class
    let class3: Class
    let class4: Class
    let testClient: ApolloServerTestClient
    let schools: Map<School, Class[]>

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        clientUser1 = await createAdminUser(testClient)
        clientUser2 = await createAdminUser(testClient)
        school1 = await createSchool().save()
        class1 = await createClass([school1]).save()
        class2 = await createClass([school1]).save()

        school2 = await createSchool().save()
        class3 = await createClass([school2]).save()
        class4 = await createClass([school2]).save()

        schools = new Map([
            [school1, [class1, class2]],
            [school2, [class3, class4]],
        ])

        const token = { id: clientUser1.user_id, email: clientUser1.email }
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

            const sorted = schools
                .get(school1)!
                .map((_class) => _class.class_name)
                .sort()

            expect(result.edges.map((e) => e.node.name)).deep.equal(sorted)
        })
    })

    context('resolver', () => {
        let ctx: Pick<Context, 'loaders'>

        beforeEach(() => {
            ctx = { loaders }
        })

        it('returns correct classes per school', async () => {
            const args: IChildPaginationArgs = {
                direction: 'FORWARD',
                count: 2,
            }

            const result = await classesChildConnection(
                school1.school_id,
                args,
                ctx,
                false
            )

            expect(result.edges.map((e) => e.node.id)).to.have.same.members([
                class1.class_id,
                class2.class_id,
            ])
        })

        it('uses exactly one dataloader when called with different schools', async () => {
            connection.logger.reset()
            const loaderResults = []

            for (const school of [school1, school2]) {
                const loaderResult = classesChildConnection(
                    school.school_id,
                    {},
                    ctx,
                    false
                )
                loaderResults.push(loaderResult)
            }

            await Promise.all(loaderResults)
            expect(connection.logger.count).to.be.eq(1)
        })

        context('totalCount', async () => {
            let fakeInfo: any

            beforeEach(() => {
                fakeInfo = {
                    fieldNodes: [
                        {
                            kind: 'Field',
                            name: {
                                kind: 'Name',
                                value: 'classesConnection',
                            },
                            selectionSet: {
                                kind: 'SelectionSet',
                                selections: [],
                            },
                        },
                    ],
                }
            })

            const callResolver = (
                fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
            ) => {
                return classesChildConnectionResolver(
                    school2.school_id,
                    {},
                    ctx,
                    fakeInfo
                )
            }

            it('returns total count', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })

                const result = await callResolver(fakeInfo)

                expect(result.totalCount).to.eq(schools.get(school2)?.length)
            })

            it('doesnt return total count', async () => {
                const result = await callResolver(fakeInfo)

                expect(result.totalCount).to.eq(undefined)
            })
        })
    })
})
