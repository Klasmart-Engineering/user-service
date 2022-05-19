import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { AgeRange } from '../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../src/entities/ageRangeUnit'
import { Organization } from '../../../src/entities/organization'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import AgeRangesInitializer from '../../../src/initializers/ageRanges'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import {
    loadAgeRangesForOrganization,
    ageRangesChildConnectionResolver as resolverForOrganization,
} from '../../../src/schemas/organization'
import {
    loadAgeRangesForClass,
    ageRangesChildConnectionResolver as resolverForClass,
} from '../../../src/schemas/class'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { ageRangesConnection } from '../../utils/operations/modelOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { getAdminAuthToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import { Class } from '../../../src/entities/class'
import { createClass } from '../../factories/class.factory'
import { createProgram } from '../../factories/program.factory'
import { Program } from '../../../src/entities/program'
import {
    loadAgeRangesForProgram,
    ageRangesChildConnectionResolver as resolverForProgram,
} from '../../../src/schemas/program'
import { checkPageInfo } from '../../acceptance/utils'
import { getConnection } from 'typeorm'
import { IEdge } from '../../../src/utils/pagination/paginate'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRange'
import faker from 'faker'

use(chaiAsPromised)

describe('model', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org1AgeRanges: AgeRange[] = []
    let org2AgeRanges: AgeRange[] = []
    let ageRanges: AgeRange[] = []
    let systemAgeRanges: AgeRange[] = []

    const ageRangesCount = 12

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()

        systemAgeRanges = await AgeRange.find({
            where: { system: true, status: Status.ACTIVE },
        })

        admin = await createAdminUser(testClient)
        org1 = createOrganization(admin)
        org2 = createOrganization(admin)
        await connection.manager.save([org1, org2])

        org1AgeRanges = []
        org2AgeRanges = []
        ageRanges = []
        const units = [AgeRangeUnit.MONTH, AgeRangeUnit.YEAR]
        for (let i = 1; i <= ageRangesCount; i++) {
            const ageRange = createAgeRange(org1, i, faker.datatype.number(99))
            ageRange.name = `age range ${i}`
            ageRange.low_value_unit = units[faker.datatype.number(1)]
            ageRange.high_value_unit = units[faker.datatype.number(1)]
            ageRange.status = Status.ACTIVE
            org1AgeRanges.push(ageRange)
        }

        for (let i = 1; i <= ageRangesCount; i++) {
            const ageRange = createAgeRange(org2, i, faker.datatype.number(99))
            ageRange.name = `age range ${i}`
            ageRange.low_value_unit = units[faker.datatype.number(1)]
            ageRange.high_value_unit = units[faker.datatype.number(1)]
            ageRange.status = Status.INACTIVE
            org2AgeRanges.push(ageRange)
        }

        ageRanges.push(...org1AgeRanges, ...org2AgeRanges)

        await connection.manager.save(ageRanges)
    })

    context('pagination', () => {
        it('returns age ranges from all the list', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() }
            )

            checkPageInfo(result, ageRanges.length + systemAgeRanges.length)
        })
    })

    context('sorting', () => {
        const checkIfOrdered = (
            edges: IEdge<AgeRangeConnectionNode>[],
            order: 'ASC' | 'DESC'
        ) => {
            for (let x = 1; x < edges.length; x++) {
                const currentNode = edges[x].node
                const previousNode = edges[x - 1].node
                if (
                    order === 'ASC'
                        ? currentNode.lowValueUnit < previousNode.lowValueUnit
                        : currentNode.lowValueUnit > previousNode.lowValueUnit
                ) {
                    return false
                } else if (
                    currentNode.lowValueUnit === previousNode.lowValueUnit
                ) {
                    if (
                        order === 'ASC'
                            ? currentNode.lowValue < previousNode.lowValue
                            : currentNode.lowValue > previousNode.lowValue
                    ) {
                        return false
                    } else if (currentNode.lowValue === previousNode.lowValue) {
                        if (
                            order === 'ASC'
                                ? currentNode.highValueUnit <
                                  previousNode.highValueUnit
                                : currentNode.highValueUnit >
                                  previousNode.highValueUnit
                        ) {
                            return false
                        } else if (
                            currentNode.highValueUnit ===
                            previousNode.highValueUnit
                        ) {
                            if (
                                order === 'ASC'
                                    ? currentNode.highValue <
                                      previousNode.highValue
                                    : currentNode.highValue >
                                      previousNode.highValue
                            ) {
                                return false
                            } else if (
                                currentNode.highValue ===
                                    previousNode.highValue &&
                                (order === 'ASC'
                                    ? currentNode.id < previousNode.id
                                    : currentNode.id > previousNode.id)
                            ) {
                                return false
                            }
                        }
                    }
                }
            }
            return true
        }
        it('returns age ranges sorted by id in an ascending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            checkPageInfo(result, ageRanges.length + systemAgeRanges.length)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns age ranges sorted by id in a descending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            checkPageInfo(result, ageRanges.length + systemAgeRanges.length)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns age ranges sorted by age range (low value unit, low value, high value unit, high value) in an ascending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                undefined,
                {
                    field: [
                        'lowValueUnit',
                        'lowValue',
                        'highValueUnit',
                        'highValue',
                    ],
                    order: 'ASC',
                }
            )

            checkPageInfo(result, ageRanges.length + systemAgeRanges.length)
            const isItOrdered = checkIfOrdered(result.edges, 'ASC')
            expect(isItOrdered).to.be.true
        })

        it('returns age ranges sorted by age range (low value unit, low value, high value unit, high value) in a descending order', async () => {
            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                undefined,
                {
                    field: [
                        'lowValueUnit',
                        'lowValue',
                        'highValueUnit',
                        'highValue',
                    ],
                    order: 'DESC',
                }
            )

            checkPageInfo(result, ageRanges.length + systemAgeRanges.length)
            const isItOrdered = checkIfOrdered(result.edges, 'DESC')
            expect(isItOrdered).to.be.true
        })
    })

    context('filtering', () => {
        it('supports filtering by organization ID', async () => {
            const organizationId = org1.organization_id
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: organizationId,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            checkPageInfo(result)

            const ageRangeIds = result.edges.map((edge) => edge.node.id)
            const org1AgeRangeIds = org1AgeRanges.map((ageRange) => ageRange.id)
            ageRangeIds.every((id) => org1AgeRangeIds.includes(id))
        })

        it('supports filtering by age range status', async () => {
            const filterStatus = 'inactive'
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(ageRangesCount)

            const statuses = result.edges.map((edge) => edge.node.status)
            statuses.every((status) => status === filterStatus)
        })

        it('supports filtering by age range system', async () => {
            const filterSystem = true
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(systemAgeRanges.length)

            const systems = result.edges.map((edge) => edge.node.system)
            systems.every((system) => system === filterSystem)
        })

        it('supports filtering by age range unit from', async () => {
            const unit = AgeRangeUnit.MONTH
            const filter: IEntityFilter = {
                ageRangeUnitFrom: {
                    operator: 'eq',
                    value: unit,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            const actualAgeRangesCount = ageRanges.filter(
                (a) => a.low_value_unit === unit
            )
            expect(result.totalCount).to.eq(actualAgeRangesCount.length)

            const filteredAgeRanges = result.edges.map((edge) => edge.node)
            filteredAgeRanges.every((ar) => ar.lowValueUnit === unit)
        })

        it('supports filtering by age range unit to', async () => {
            const unit = AgeRangeUnit.YEAR
            const filter: IEntityFilter = {
                ageRangeUnitTo: {
                    operator: 'eq',
                    value: unit,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            const actualAgeRangesCount = ageRanges.filter(
                (a) => a.high_value_unit === unit
            )
            expect(result.totalCount).to.eq(
                actualAgeRangesCount.length + systemAgeRanges.length
            )

            const filteredAgeRanges = result.edges.map((edge) => edge.node)
            filteredAgeRanges.every((ar) => ar.highValueUnit === unit)
        })

        it('supports filtering by age range value from', async () => {
            const value = 10
            const filter: IEntityFilter = {
                ageRangeValueFrom: {
                    operator: 'eq',
                    value: value,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            const actualAgeRangesCount = ageRanges.filter(
                (a) => a.low_value === value
            )
            expect(result.totalCount).to.eq(actualAgeRangesCount.length)

            const filteredAgeRanges = result.edges.map((edge) => edge.node)
            filteredAgeRanges.every((ar) => ar.lowValue === value)
        })

        it('supports filtering by age range value to', async () => {
            const value = 10
            const filter: IEntityFilter = {
                ageRangeValueTo: {
                    operator: 'eq',
                    value: value,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            const actualAgeRangesCount = ageRanges.filter(
                (a) => a.high_value === value
            )
            expect(result.totalCount).to.eq(actualAgeRangesCount.length)

            const filteredAgeRanges = result.edges.map((edge) => edge.node)
            filteredAgeRanges.every((ar) => ar.highValue === value)
        })

        it('supports filtering by age range value/unit from', async () => {
            const value = 10
            const unit = AgeRangeUnit.YEAR
            const filter: IEntityFilter = {
                ageRangeValueFrom: {
                    operator: 'eq',
                    value: value,
                },
                ageRangeUnitFrom: {
                    operator: 'eq',
                    value: unit,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            const actualAgeRangesCount = ageRanges.filter(
                (a) => a.low_value === value && a.low_value_unit === unit
            )
            expect(result.totalCount).to.eq(actualAgeRangesCount.length)

            const filteredAgeRanges = result.edges.map((edge) => edge.node)
            filteredAgeRanges.every((ar) => {
                expect(ar.lowValue).eq(value)
                expect(ar.lowValueUnit).eq(unit)
            })
        })

        it('supports filtering by age range value/unit to', async () => {
            const value = 10
            const unit = AgeRangeUnit.MONTH
            const filter: IEntityFilter = {
                ageRangeValueTo: {
                    operator: 'eq',
                    value: value,
                },
                ageRangeUnitTo: {
                    operator: 'eq',
                    value: unit,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )

            const actualAgeRangesCount = ageRanges.filter(
                (a) => a.high_value === value && a.high_value_unit === unit
            )
            expect(result.totalCount).to.eq(actualAgeRangesCount.length)

            const filteredAgeRanges = result.edges.map((edge) => edge.node)
            filteredAgeRanges.every((ar) => {
                expect(ar.highValue).eq(value)
                expect(ar.highValueUnit).eq(unit)
            })
        })

        it('supports filtering by program ID', async () => {
            const programAgeRanges = org1AgeRanges.slice(0, 2)
            const program = await createProgram(org1, programAgeRanges).save()
            const filter: IEntityFilter = {
                programId: {
                    operator: 'eq',
                    value: program.id,
                },
            }

            const result = await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                true,
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(result.totalCount).to.eq(2)
            expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                programAgeRanges.map((a) => a.id)
            )
        })
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await ageRangesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                false,
                { authorization: getAdminAuthToken() }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('ageRangesConnectionChild', () => {
        let ctx: Pick<Context, 'loaders'>
        let fakeInfo: any
        let organizationMember1: User
        let class1: Class
        let class2: Class
        let program: Program

        beforeEach(async () => {
            organizationMember1 = await createUser().save()
            await createOrganizationMembership({
                user: organizationMember1,
                organization: org1,
            }).save()
            const token = { id: organizationMember1.user_id }
            const permissions = new UserPermissions(token)
            ctx = { loaders: createContextLazyLoaders(permissions) }
            fakeInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'ageRangesConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }

            program = await createProgram(org1, org1AgeRanges).save()
            class1 = await createClass(undefined, org1).save()
            class2 = await createClass(undefined, org1).save()
            ;(await class1.age_ranges)?.push(...org1AgeRanges)
            ;(await class2.age_ranges)?.push(...org1AgeRanges)
            await connection.manager.save([class1, class2])
        })

        context('as child of an organization', () => {
            it('returns ageRanges per organization and system age ranges', async () => {
                const result = await loadAgeRangesForOrganization(
                    ctx,
                    org1.organization_id
                )
                expect(result.totalCount).to.eq(
                    org1AgeRanges.length + systemAgeRanges.length
                )
                expect(
                    org1AgeRanges.concat(systemAgeRanges).map((m) => m.id)
                ).include.members(result.edges.map((e) => e.node.id))
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForOrganization(
                    { id: org1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(
                    org1AgeRanges.length + systemAgeRanges.length
                )
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForOrganization(
                    { id: org1.organization_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        context('as child of a program', () => {
            it('returns age ranges per program', async () => {
                const result = await loadAgeRangesForProgram(ctx, program.id)
                expect(result.edges).to.have.lengthOf(org1AgeRanges.length)
                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    org1AgeRanges.map((m) => m.id)
                )
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForProgram(
                    { id: program.id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(org1AgeRanges.length)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForProgram(
                    { id: program.id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        context('as child of a class', () => {
            it('returns age ranges per class', async () => {
                const result = await loadAgeRangesForClass(ctx, class1.class_id)
                expect(result.edges).to.have.lengthOf(org1AgeRanges.length)
                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    org1AgeRanges.map((m) => m.id)
                )
            })
            it('returns totalCount when requested', async () => {
                fakeInfo.fieldNodes[0].selectionSet?.selections.push({
                    kind: 'Field',
                    name: { kind: 'Name', value: 'totalCount' },
                })
                const result = await resolverForClass(
                    { id: class1.class_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(org1AgeRanges.length)
            })
            it('omits totalCount when not requested', async () => {
                const result = await resolverForClass(
                    { id: class1.class_id },
                    {},
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.be.undefined
            })
        })

        it('uses exactly one dataloader when called with different parent', async () => {
            connection.logger.reset()
            const loaderResults = []
            for (const cl of [class1, class2]) {
                loaderResults.push(
                    loadAgeRangesForClass(ctx, class1.class_id, {}, false)
                )
            }
            await Promise.all(loaderResults)

            expect(connection.logger.count).to.be.eq(1)
        })
        context('sorting', () => {
            let classAgeRanges: AgeRange[]
            beforeEach(() => {
                classAgeRanges = org1AgeRanges.slice(0, 2)
            })
            it('sorts by id', async () => {
                const result = await loadAgeRangesForClass(
                    ctx,
                    class1.class_id,
                    {
                        sort: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = org1AgeRanges.map((m) => m.id).sort()
                expect(result.edges.map((e) => e.node.id)).to.deep.equal(sorted)
            })
            it('sorts by name', async () => {
                const result = await loadAgeRangesForClass(
                    ctx,
                    class1.class_id,
                    {
                        sort: {
                            field: 'name',
                            order: 'ASC',
                        },
                    },
                    false
                )
                const sorted = org1AgeRanges
                    .map((m) => m.name)
                    .sort(function (a, b) {
                        return (a as string).localeCompare(b as string)
                    })
                expect(result.edges.map((e) => e.node.name)).to.deep.equal(
                    sorted
                )
            })
        })
        context('totalCount', () => {
            it('returns total count', async () => {
                const result = await loadAgeRangesForClass(
                    ctx,
                    class1.class_id,
                    {},
                    true
                )
                expect(result.totalCount).to.eq(org1AgeRanges.length)
            })
            it('does not return total count', async () => {
                const result = await loadAgeRangesForClass(
                    ctx,
                    class1.class_id,
                    {},
                    false
                )
                expect(result.totalCount).to.not.exist
            })
        })
    })
})
