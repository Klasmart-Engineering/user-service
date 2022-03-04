import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { GraphQLResolveInfo } from 'graphql'
import { Category } from '../../../src/entities/category'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { Status } from '../../../src/entities/status'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import { Model } from '../../../src/model'
import { CoreSubjectConnectionNode } from '../../../src/pagination/subjectsConnection'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import {
    loadSubjectsForCategory,
    subjectsChildConnectionResolver as categorySubjectsResolver,
} from '../../../src/schemas/category'
import {
    loadSubjectsForClass,
    subjectsChildConnectionResolver as classSubjectsResolver,
} from '../../../src/schemas/class'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import {
    IChildPaginationArgs,
    MAX_PAGE_SIZE,
} from '../../../src/utils/pagination/paginate'
import { createCategory } from '../../factories/category.factory'
import { createClass } from '../../factories/class.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createProgram } from '../../factories/program.factory'
import { createSubject } from '../../factories/subject.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    subjectsConnection,
    subjectsConnectionMainData,
} from '../../utils/operations/modelOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import {
    addUserToOrganizationAndValidate,
    getSystemRoleIds,
} from '../../utils/operations/organizationOps'
import { userToPayload } from '../../utils/operations/userOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import {
    loadSubjectsForProgram,
    subjectsChildConnectionResolver as programSubjectsResolver,
} from '../../../src/schemas/program'
import { getConnection } from 'typeorm'
import { checkPageInfo } from '../../acceptance/utils'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('subjectsConnection', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let orgOwner: User
    let orgMember: User
    let org1: Organization
    let org2: Organization
    let org1Categories: Category[] = []
    let org2Categories: Category[] = []
    let categories: Category[] = []
    let org1Subjects: Subject[] = []
    let org2Subjects: Subject[] = []
    let subjects: Subject[] = []

    const categoriesCount = 16
    const subjectsCount = 8

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        const systemRoles = await getSystemRoleIds()
        const orgAdminRoleId = systemRoles['Organization Admin']

        org1Categories = []
        org2Categories = []
        categories = []
        org1Subjects = []
        org2Subjects = []
        subjects = []

        // Creating Users
        admin = await createAdminUser(testClient)
        orgOwner = await createUser()
        orgMember = await createUser()
        await connection.manager.save([orgOwner, orgMember])

        // Creating Organizations
        org1 = await createOrganization(admin)
        org2 = await createOrganization(orgOwner)
        await connection.manager.save([org1, org2])

        // Add admin to org1
        await addUserToOrganizationAndValidate(
            testClient,
            admin.user_id,
            org1.organization_id,
            { authorization: getAdminAuthToken() }
        )

        // Add orgOwner to org2
        await addUserToOrganizationAndValidate(
            testClient,
            orgOwner.user_id,
            org2.organization_id,
            { authorization: getAdminAuthToken() }
        )

        // Add role to admin
        await addRoleToOrganizationMembership(
            testClient,
            admin.user_id,
            org1.organization_id,
            orgAdminRoleId
        )

        // Add role to orgOwner
        await addRoleToOrganizationMembership(
            testClient,
            orgOwner.user_id,
            org2.organization_id,
            orgAdminRoleId
        )

        // Creating Org1 Categories
        for (let i = 0; i < categoriesCount; i++) {
            const category = await createCategory(org1)
            org1Categories.push(category)
        }

        // Creating Org2 Categories
        for (let i = 0; i < categoriesCount; i++) {
            const category = await createCategory(org2)
            org2Categories.push(category)
        }

        categories.push(...org1Categories, ...org2Categories)
        await connection.manager.save(categories)

        // Creating Org1 Subjects
        for (let i = 0; i < subjectsCount; i++) {
            const index = i * (categoriesCount / subjectsCount)
            const subject = await createSubject(org1, [
                org1Categories[index],
                org1Categories[index + 1],
            ])

            subject.name = `Subject ${i + 1}`
            org1Subjects.push(subject)
        }

        // Creating Org2 Subjects
        for (let i = 0; i < subjectsCount; i++) {
            const index = i * (categoriesCount / subjectsCount)
            const subject = await createSubject(org2, [
                org2Categories[index],
                org2Categories[index + 1],
            ])

            subject.name = `Subject ${i + 1}`
            org2Subjects.push(subject)
        }

        subjects.push(...org1Subjects, ...org2Subjects)
        await connection.manager.save(subjects)
    })

    context('pagination', () => {
        it('returns all the subjects if the user is a super admin', async () => {
            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            checkPageInfo(result, subjectsCount * 2)
        })

        it("returns the subjects that belongs to user's organization", async () => {
            const token = generateToken(userToPayload(orgOwner))
            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: token }
            )

            expect(result.totalCount).to.eq(subjectsCount)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(subjectsCount)
        })

        it('returns empty if the user has not organization', async () => {
            const token = generateToken(userToPayload(orgMember))
            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: token }
            )

            expect(result.totalCount).to.eq(0)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.pageInfo.startCursor).to.be.empty
            expect(result.pageInfo.endCursor).to.be.empty

            expect(result.edges.length).eq(0)
        })

        context('linked data', () => {
            beforeEach(async () => {
                const categories = []

                for (let i = 0; i < 60; i++) {
                    const category = createCategory(org2)
                    categories.push(category)
                }

                await connection.manager.save(categories)

                for (const subject of org2Subjects) {
                    subject.categories = Promise.resolve(categories)
                }

                await connection.manager.save(org2Subjects)
            })

            it("subjects' linked data has not more than 50 elements per entity", async () => {
                const token = generateToken(userToPayload(orgOwner))
                const result = await subjectsConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: token }
                )

                expect(result.totalCount).to.eq(subjectsCount)

                expect(result.pageInfo.hasNextPage).to.be.false
                expect(result.pageInfo.hasPreviousPage).to.be.false

                expect(result.edges.length).eq(subjectsCount)

                const subjects = result.edges

                subjects.every((subject) => {
                    expect(subject.node.categories?.length).to.eq(MAX_PAGE_SIZE)
                })
            })
        })
    })

    context('sorting', () => {
        it('returns subjects sorted by id in and ascending order', async () => {
            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(subjectsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns subjects sorted by id in and descending order', async () => {
            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(subjectsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns subjects sorted by name in and ascending order', async () => {
            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(subjectsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name || '')
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns subjects sorted by name in and descending order', async () => {
            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(subjectsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name || '')
            const isSorted = isStringArraySortedDescending(names)

            expect(isSorted).to.be.true
        })
    })

    context('filtering', () => {
        let class_: Class
        let program: Program
        let subjectsToFilter: Subject[]

        beforeEach(async () => {
            subjectsToFilter = org1Subjects.slice(0, subjectsCount / 2)
            class_ = createClass(undefined, org1)
            class_.subjects = Promise.resolve(subjectsToFilter)
            await class_.save()

            program = await createProgram(
                org1,
                undefined,
                undefined,
                subjectsToFilter
            ).save()

            for (let i = 0; i < subjectsCount; i++) {
                org1Subjects[i].status = i % 2 ? Status.ACTIVE : Status.INACTIVE
                org2Subjects[i].system = !!(i % 2)
            }

            await connection.manager.save(org1Subjects)
            await connection.manager.save(org2Subjects)
        })

        it('supports filtering by organization ID', async () => {
            const organizationId = org1.organization_id
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: organizationId,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(subjectsCount)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(subjectsCount)

            const subjects = result.edges
            const org1SubjectIds = org1Subjects.map((s) => s.id)

            subjects.forEach((subject) => {
                expect(org1SubjectIds).includes(subject.node.id)
            })
        })

        it('supports filtering by subject status', async () => {
            const filterStatus = Status.INACTIVE
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(subjectsCount / 2)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(subjectsCount / 2)

            const subjects = result.edges

            subjects.forEach((subject) => {
                expect(subject.node.status).to.eq(filterStatus)
            })
        })

        it('supports filtering by subject system', async () => {
            const filterSystem = true
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(subjectsCount / 2)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(subjectsCount / 2)

            const subjects = result.edges

            subjects.forEach((subject) => {
                expect(subject.node.system).to.eq(filterSystem)
            })
        })

        it('supports filtering by subject id', async () => {
            const subjectId = org1Subjects[0].id
            const filter: IEntityFilter = {
                id: {
                    operator: 'eq',
                    value: subjectId,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(1)

            const subjects = result.edges
            subjects.forEach((subject) => {
                expect(subject.node.id).to.eq(subjectId)
            })
        })

        it('supports filtering by subject name', async () => {
            const search = '2'
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: search,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(2)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(2)

            const subjects = result.edges

            subjects.forEach((subject) => {
                expect(subject.node.name).includes(search)
            })
        })

        it('supports filtering by category ID', async () => {
            const categoryId = categories[0].id
            const filter: IEntityFilter = {
                id: {
                    operator: 'eq',
                    value: categoryId,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            const categoryIds = result.edges.map((edge) => {
                return edge.node.categories?.map((category) => category.id)
            })

            categoryIds.every((ids) => ids?.includes(categoryId))
        })

        it('supports filtering by class ID', async () => {
            const classId = class_.class_id
            const filter: IEntityFilter = {
                classId: {
                    operator: 'eq',
                    value: classId,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            const subjectIds = result.edges.map((e) => e.node.id)
            const toFilterIds = subjectsToFilter.map((s) => s.id)
            expect(subjectIds).to.deep.equalInAnyOrder(toFilterIds)
        })

        it('supports filtering by program ID', async () => {
            const programId = program.id
            const filter: IEntityFilter = {
                programId: {
                    operator: 'eq',
                    value: programId,
                },
            }

            const result = await subjectsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            const subjectIds = result.edges.map((e) => e.node.id)
            const toFilterIds = subjectsToFilter.map((s) => s.id)
            expect(subjectIds).to.deep.equalInAnyOrder(toFilterIds)
        })
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await subjectsConnectionMainData(
                testClient,
                'FORWARD',
                { count: 10 },
                false,
                { authorization: getAdminAuthToken() }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('as child connection', () => {
        let ctx: { loaders: IDataLoaders }
        let fakeResolverInfo: any
        let org1Classes: Class[]
        let org1Programs: Program[]
        const classesCount = 2
        const programsCount = 2

        beforeEach(async () => {
            const token = { id: admin.user_id }
            const permissions = new UserPermissions(token)
            ctx = { loaders: createContextLazyLoaders(permissions) }

            org1Classes = await Class.save(
                Array.from(new Array(classesCount), (_, i) => {
                    const class_ = createClass(undefined, org1)
                    const start = i ? subjectsCount / 2 - 1 : 0
                    const end = i ? undefined : subjectsCount / 2
                    class_.subjects = Promise.resolve(
                        org1Subjects.slice(start, end)
                    )

                    return class_
                })
            )

            org1Programs = await Program.save(
                Array.from(new Array(programsCount), (_, i) => {
                    const start = i ? subjectsCount / 2 - 1 : 0
                    const end = i ? undefined : subjectsCount / 2
                    return createProgram(
                        org1,
                        undefined,
                        undefined,
                        org1Subjects.slice(start, end)
                    )
                })
            )

            fakeResolverInfo = {
                fieldNodes: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: 'subjectsConnection',
                        },
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: [],
                        },
                    },
                ],
            }
        })

        context('common across all parents', () => {
            const resolveForSubjects = async (classes: Class[]) => {
                const loaderResults = []
                for (const c of classes) {
                    const loaderResult = loadSubjectsForClass(
                        ctx,
                        c.class_id,
                        {},
                        false
                    )

                    loaderResults.push(loaderResult)
                }

                await Promise.all(loaderResults)
            }

            it("db calls doesn't increase with number of resolver calls", async () => {
                // warm up permission caches
                await resolveForSubjects(org1Classes.slice(0, 2))
                connection.logger.reset()

                await resolveForSubjects(org1Classes.slice(0, 1))
                const dbCallsForSingleClass = connection.logger.count
                connection.logger.reset()

                await resolveForSubjects(org1Classes.slice(0, 2))
                const dbCallsForTwoClasses = connection.logger.count
                expect(dbCallsForSingleClass).to.be.eq(dbCallsForTwoClasses)
            })

            context('sorting', () => {
                let args: IChildPaginationArgs

                beforeEach(() => {
                    args = {
                        direction: 'FORWARD',
                        count: 5,
                        sort: {
                            field: 'name',
                            order: 'ASC',
                        },
                    }
                })

                const checkSorted = async (
                    entityProperty: keyof Subject,
                    fieldName: keyof CoreSubjectConnectionNode
                ) => {
                    const classToCheck = org1Classes[0]
                    const subjectsToCheck = (await classToCheck.subjects) as Subject[]

                    const result = await loadSubjectsForClass(
                        ctx,
                        classToCheck.class_id,
                        args,
                        false
                    )

                    const sorted = subjectsToCheck
                        .map((p) => p[entityProperty])
                        .sort((a, b) => {
                            // pagination sorting sorts in a case insensitive way
                            return (a as string)
                                .toLowerCase()
                                .localeCompare((b as string).toLowerCase())
                        })

                    expect(
                        result.edges.map((e) => e.node[fieldName])
                    ).deep.equal(sorted)
                }

                it('sorts by id', async () => {
                    args.sort!.field = 'id'
                    await checkSorted('id', 'id')
                })

                it('sorts by name', async () => {
                    args.sort!.field = 'name'
                    await checkSorted('name', 'name')
                })
            })
        })

        context('category parent', () => {
            it('returns correct subjects per category', async () => {
                const categoryToCheck = org1Categories[0]
                const subjectsToCheck = (await categoryToCheck.subjects) as Subject[]
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 5,
                }

                const result = await loadSubjectsForCategory(
                    ctx,
                    categoryToCheck.id,
                    args,
                    false
                )

                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    subjectsToCheck.map((p) => p.id)
                )
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) =>
                    categorySubjectsResolver(
                        { id: org1Categories[0].id },
                        {},
                        ctx,
                        fakeInfo
                    )

                it('returns total count', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(1)
                })

                it("doesn't return total count", async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })

        context('class parent', () => {
            it('returns correct subjects per class', async () => {
                const classToCheck = org1Classes[0]
                const subjectsToCheck = (await classToCheck.subjects) as Subject[]
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 5,
                }

                const result = await loadSubjectsForClass(
                    ctx,
                    classToCheck.class_id,
                    args,
                    false
                )

                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    subjectsToCheck.map((p) => p.id)
                )
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) =>
                    classSubjectsResolver(
                        { id: org1Classes[0].class_id },
                        {},
                        ctx,
                        fakeInfo
                    )

                it('returns total count', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(
                        subjectsCount / classesCount
                    )
                })

                it("doesn't return total count", async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })

        context('program parent', () => {
            it('returns correct subjects per program', async () => {
                const programToCheck = org1Programs[0]
                const subjectsToCheck = (await programToCheck.subjects) as Subject[]
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 5,
                }

                const result = await loadSubjectsForProgram(
                    ctx,
                    programToCheck.id,
                    args,
                    false
                )

                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    subjectsToCheck.map((p) => p.id)
                )
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) =>
                    programSubjectsResolver(
                        { id: org1Programs[0].id },
                        {},
                        ctx,
                        fakeInfo
                    )

                it('returns total count', async () => {
                    fakeResolverInfo.fieldNodes[0].selectionSet?.selections.push(
                        {
                            kind: 'Field',
                            name: { kind: 'Name', value: 'totalCount' },
                        }
                    )

                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(
                        subjectsCount / programsCount
                    )
                })

                it("doesn't return total count", async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })
    })
})
