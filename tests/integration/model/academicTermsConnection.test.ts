import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { GraphQLResolveInfo } from 'graphql'
import { getConnection } from 'typeorm'
import { AcademicTerm } from '../../../src/entities/academicTerm'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import {
    academicTermsChildConnectionResolver,
    loadAcademicTermsForSchool,
} from '../../../src/schemas/school'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import { createSuccessiveAcademicTerms } from '../../factories/academicTerm.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createSchools } from '../../factories/school.factory'
import { createAdminUser } from '../../factories/user.factory'
import { userToPayload } from '../../utils/operations/userOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { TestConnection } from '../../utils/testConnection'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('AcademicTermsConnection', () => {
    let connection: TestConnection
    let admin: User
    let schools: School[]
    let school1ATs: AcademicTerm[]
    let school2ATs: AcademicTerm[]

    const school1ATCount = 6
    const school2ATCount = 4

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        admin = await createAdminUser().save()
        const org = await createOrganization().save()
        schools = await School.save(createSchools(2, org))
        school1ATs = await AcademicTerm.save(
            createSuccessiveAcademicTerms(school1ATCount, schools[0])
        )
        school2ATs = await AcademicTerm.save(
            createSuccessiveAcademicTerms(school2ATCount, schools[1])
        )
    })

    context('as child connection', async () => {
        let fakeResolverInfo: any

        beforeEach(() => {
            fakeResolverInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'academicTermsConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })

        context('school parent', async () => {
            let ctx: { loaders: IDataLoaders }

            beforeEach(async () => {
                const permissions = new UserPermissions(userToPayload(admin))
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns correct academic terms per school', async () => {
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 10,
                }
                const school1Results = await loadAcademicTermsForSchool(
                    ctx,
                    schools[0].school_id,
                    args,
                    false
                )
                const school2Results = await loadAcademicTermsForSchool(
                    ctx,
                    schools[1].school_id,
                    args,
                    false
                )

                expect(
                    school1Results.edges.map((e) => e.node.id)
                ).to.have.same.members(school1ATs.map((at) => at.id))
                expect(
                    school2Results.edges.map((e) => e.node.id)
                ).to.have.same.members(school2ATs.map((at) => at.id))
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) =>
                    academicTermsChildConnectionResolver(
                        { id: schools[0].school_id },
                        {},
                        ctx,
                        fakeInfo
                    )

                it('returns total count, if requested', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(school1ATCount)
                })

                it("doesn't return total count", async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })
    })
    context('filtering and sorting', () => {
        function randomIndex(max: number) {
            return Math.floor(Math.random() * max)
        }
        const fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'> = {
            fieldNodes: [
                {
                    kind: 'Field',
                    name: {
                        kind: 'Name',
                        value: 'academicTermsConnection',
                    },
                    selectionSet: {
                        kind: 'SelectionSet',
                        selections: [
                            {
                                kind: 'Field',
                                name: {
                                    kind: 'Name',
                                    value: 'totalCount',
                                },
                            },
                        ],
                    },
                },
            ],
        }

        let ctx: { loaders: IDataLoaders }
        let inactiveCount = 0
        beforeEach(async () => {
            const permissions = new UserPermissions(userToPayload(admin))
            ctx = { loaders: createContextLazyLoaders(permissions) }
        })
        context('status', () => {
            beforeEach(async () => {
                const ats = (await schools[0].academicTerms) || []
                for (let index = 0; index < ats.length; index++) {
                    if (index % 2) {
                        ats[index].status = Status.INACTIVE
                        inactiveCount++
                    }
                }
                await AcademicTerm.save(ats)
            })
            it('supports filtering by status', async () => {
                const filterStatus = 'inactive'
                const filter: IEntityFilter = {
                    status: {
                        operator: 'eq',
                        value: filterStatus,
                    },
                }

                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        filter,
                    },
                    ctx,
                    fakeInfo
                )

                expect(result.totalCount).to.eq(inactiveCount)
                const statuses = result.edges.map((edge) => edge.node.status)
                statuses.every((status) => status === filterStatus)
            })
        })
        context('id', () => {
            let id: string
            beforeEach(async () => {
                const ats = (await schools[0].academicTerms) || []
                const index = randomIndex(ats.length)
                id = ats[index].id
            })
            it('supports filtering by id', async () => {
                const filter: IEntityFilter = {
                    id: {
                        operator: 'eq',
                        value: id,
                    },
                }

                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        filter,
                    },
                    ctx,
                    fakeInfo
                )

                expect(result.totalCount).to.eq(1)
                expect(result.edges.length).to.equal(1)
                expect(result.edges[0].node.id).to.equal(id)
            })
        })
        context('name contains', () => {
            let name: string
            let mickyCount = 0
            beforeEach(async () => {
                const ats = (await schools[0].academicTerms) || []
                for (let index = 0; index < ats.length; index++) {
                    if (index % 2) {
                        ats[index].name = 'MickyMouse ' + index
                        mickyCount++
                    }
                }
                await AcademicTerm.save(ats)
            })
            it('supports filtering by name contains', async () => {
                const filter: IEntityFilter = {
                    name: {
                        operator: 'contains',
                        value: 'MickyMouse',
                    },
                }

                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        filter,
                    },
                    ctx,
                    fakeInfo
                )

                expect(result.totalCount).to.eq(mickyCount)
                const names = result.edges.map((edge) => edge.node.name)
                names.every((n) => n.includes('MickyMouse'))
            })
        })
        context('name eq', () => {
            let name: string
            beforeEach(async () => {
                const ats = (await schools[0].academicTerms) || []
                const index = randomIndex(ats.length)
                name = ats[index].name
            })
            it('supports filtering by name eq', async () => {
                const filter: IEntityFilter = {
                    name: {
                        operator: 'eq',
                        value: name,
                    },
                }

                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        filter,
                    },
                    ctx,
                    fakeInfo
                )

                expect(result.totalCount).to.eq(1)
                expect(result.edges.length).to.equal(1)
                expect(result.edges[0].node.name).to.equal(name)
            })
        })

        context('sorting', () => {
            it('returns academicTerms sorted by id in an ascending order', async () => {
                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        sort: { field: 'id', order: 'ASC' },
                    },
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(school1ATCount)
                const ids = result.edges.map((edge) => edge.node.id)
                const isSorted = isStringArraySortedAscending(ids)
                expect(isSorted).to.be.true
            })
            it('returns academicTerms sorted by id in an descending order', async () => {
                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        sort: { field: 'id', order: 'DESC' },
                    },
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(school1ATCount)
                const ids = result.edges.map((edge) => edge.node.id)
                const isSorted = isStringArraySortedDescending(ids)
                expect(isSorted).to.be.true
            })
            it('returns academicTerms sorted by name in an ascending order', async () => {
                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        sort: { field: 'name', order: 'ASC' },
                    },
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(school1ATCount)
                const names = result.edges.map((edge) => edge.node.name)
                const isSorted = isStringArraySortedAscending(names)
                expect(isSorted).to.be.true
            })
            it('returns academicTerms sorted by name in an descending order', async () => {
                const result = await academicTermsChildConnectionResolver(
                    { id: schools[0].school_id },
                    {
                        direction: 'FORWARD',
                        sort: { field: 'name', order: 'DESC' },
                    },
                    ctx,
                    fakeInfo
                )
                expect(result.totalCount).to.eq(school1ATCount)
                const names = result.edges.map((edge) => edge.node.name)
                const isSorted = isStringArraySortedDescending(names)
                expect(isSorted).to.be.true
            })
        })
        it('returns academicTerms sorted by startDate in an ascending order', async () => {
            const result = await academicTermsChildConnectionResolver(
                { id: schools[0].school_id },
                {
                    direction: 'FORWARD',
                    sort: { field: 'startDate', order: 'ASC' },
                },
                ctx,
                fakeInfo
            )
            expect(result.totalCount).to.eq(school1ATCount)
            const startDates = result.edges.map((edge) =>
                edge.node.startDate.toISOString()
            )
            const isSorted = isStringArraySortedAscending(startDates)
            expect(isSorted).to.be.true
        })
        it('returns academicTerms sorted by startDate in an descending order', async () => {
            const result = await academicTermsChildConnectionResolver(
                { id: schools[0].school_id },
                {
                    direction: 'FORWARD',
                    sort: { field: 'startDate', order: 'DESC' },
                },
                ctx,
                fakeInfo
            )
            expect(result.totalCount).to.eq(school1ATCount)
            const startDates = result.edges.map((edge) =>
                edge.node.startDate.toISOString()
            )
            const isSorted = isStringArraySortedDescending(startDates)
            expect(isSorted).to.be.true
        })
        it('returns academicTerms sorted by endDate in an ascending order', async () => {
            const result = await academicTermsChildConnectionResolver(
                { id: schools[0].school_id },
                {
                    direction: 'FORWARD',
                    sort: { field: 'endDate', order: 'ASC' },
                },
                ctx,
                fakeInfo
            )
            expect(result.totalCount).to.eq(school1ATCount)
            const endDates = result.edges.map((edge) =>
                edge.node.endDate.toISOString()
            )
            const isSorted = isStringArraySortedAscending(endDates)
            expect(isSorted).to.be.true
        })
        it('returns academicTerms sorted by endDate in an descending order', async () => {
            const result = await academicTermsChildConnectionResolver(
                { id: schools[0].school_id },
                {
                    direction: 'FORWARD',
                    sort: { field: 'endDate', order: 'DESC' },
                },
                ctx,
                fakeInfo
            )
            expect(result.totalCount).to.eq(school1ATCount)
            const endDates = result.edges.map((edge) =>
                edge.node.endDate.toISOString()
            )
            const isSorted = isStringArraySortedDescending(endDates)
            expect(isSorted).to.be.true
        })
    })
})
