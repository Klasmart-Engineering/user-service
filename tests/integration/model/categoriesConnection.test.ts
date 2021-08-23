import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { Category } from '../../../src/entities/category'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { Status } from '../../../src/entities/status'
import { Subcategory } from '../../../src/entities/subcategory'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { SUMMARY_ELEMENTS_LIMIT } from '../../../src/types/paginationConstants'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createCategory } from '../../factories/category.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createProgram } from '../../factories/program.factory'
import { createSubcategory } from '../../factories/subcategory.factory'
import { createSubject } from '../../factories/subject.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { categoriesConnection } from '../../utils/operations/modelOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import {
    getSystemRoleIds,
    addUserToOrganizationAndValidate,
} from '../../utils/operations/organizationOps'
import { userToPayload } from '../../utils/operations/userOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { getAdminAuthToken, generateToken } from '../../utils/testConfig'
import { createTestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

use(chaiAsPromised)

describe('subcategoriesConnection', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let admin: User
    let orgOwner: User
    let orgMember: User
    let org1: Organization
    let org2: Organization
    let org1Subcategories: Subcategory[] = []
    let org2Subcategories: Subcategory[] = []
    let subcategories: Subcategory[] = []
    let org1Categories: Category[] = []
    let org2Categories: Category[] = []
    let categories: Category[] = []
    let org1Subjects: Subject[] = []
    let org2Subjects: Subject[] = []
    let subjects: Subject[] = []
    let org1Programs: Program[] = []
    let org2Programs: Program[] = []
    let programs: Program[] = []

    const subcategoriesCount = 16
    const categoriesCount = 8
    const subjectsCount = 4
    const programsCount = 2

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        const systemRoles = await getSystemRoleIds()
        const orgAdminRoleId = systemRoles['Organization Admin']

        org1Subcategories = []
        org2Subcategories = []
        subcategories = []
        org1Categories = []
        org2Categories = []
        categories = []
        org1Subjects = []
        org2Subjects = []
        subjects = []
        org1Programs = []
        org2Programs = []
        programs = []

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

        // Creating Org1 Subcategories
        for (let i = 0; i < subcategoriesCount; i++) {
            let subcategory = await createSubcategory(org1)
            org1Subcategories.push(subcategory)
        }

        // Creating Org2 Subcategories
        for (let i = 0; i < subcategoriesCount; i++) {
            let subcategory = await createSubcategory(org2)
            org2Subcategories.push(subcategory)
        }

        subcategories.push(...org1Subcategories, ...org2Subcategories)
        await connection.manager.save(subcategories)

        // Creating Org1 Categories
        for (let i = 0; i < categoriesCount; i++) {
            const index = i * (subcategoriesCount / categoriesCount)
            let category = await createCategory(org1, [
                org1Subcategories[index],
                org1Subcategories[index + 1],
            ])

            org1Categories.push(category)
        }

        // Creating Org2 Categories
        for (let i = 0; i < categoriesCount; i++) {
            const index = i * (subcategoriesCount / categoriesCount)
            let category = await createCategory(org2, [
                org2Subcategories[index],
                org2Subcategories[index + 1],
            ])

            org2Categories.push(category)
        }

        categories.push(...org1Categories, ...org2Categories)
        await connection.manager.save(categories)

        // Creating Org1 Subjects
        for (let i = 0; i < subjectsCount; i++) {
            const index = i * (categoriesCount / subjectsCount)
            let subject = await createSubject(org1, [
                org1Categories[index],
                org1Categories[index + 1],
            ])

            org1Subjects.push(subject)
        }

        // Creating Org2 Subjects
        for (let i = 0; i < subjectsCount; i++) {
            const index = i * (categoriesCount / subjectsCount)
            let subject = await createSubject(org2, [
                org2Categories[index],
                org2Categories[index + 1],
            ])

            org2Subjects.push(subject)
        }

        subjects.push(...org1Subjects, ...org2Subjects)
        await connection.manager.save(subjects)

        // Creating Org1 Programs
        for (let i = 0; i < programsCount; i++) {
            const index = i * (subjectsCount / programsCount)
            let program = await createProgram(org1, undefined, undefined, [
                org1Subjects[index],
                org1Subjects[index + 1],
            ])

            org1Programs.push(program)
        }

        // Creating Org2 Programs
        for (let i = 0; i < programsCount; i++) {
            const index = i * (subjectsCount / programsCount)
            let program = await createProgram(org2, undefined, undefined, [
                org2Subjects[index],
                org2Subjects[index + 1],
            ])

            org2Programs.push(program)
        }

        programs.push(...org1Programs, ...org2Programs)

        await connection.manager.save(programs)
    })

    context('pagination', () => {
        it('returns categories from all the list', async () => {
            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(categoriesCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)
        })

        it("returns the categories that belongs to user's organization", async () => {
            const token = generateToken(userToPayload(orgOwner))
            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: token }
            )

            expect(result.totalCount).to.eq(categoriesCount)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(categoriesCount)
        })

        it('returns empty if the user has not organization', async () => {
            const token = generateToken(userToPayload(orgMember))
            const result = await categoriesConnection(
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
                const subcategories = []
                const subjects = []
                const programs = []
                for (let i = 0; i < 60; i++) {
                    const subcategory = createSubcategory(org2)
                    subcategories.push(subcategory)

                    const subject = createSubject(org2)
                    subjects.push(subject)

                    const program = createProgram(org2, undefined, undefined, [
                        subject,
                    ])
                    programs.push(program)
                }

                await connection.manager.save(subcategories)
                await connection.manager.save(subjects)
                await connection.manager.save(programs)

                for (const category of org2Categories) {
                    category.subcategories = Promise.resolve(subcategories)
                    category.subjects = Promise.resolve(subjects)
                }

                await connection.manager.save(org2Categories)
            })

            it("categories' linked data has not more than 50 elements per entity", async () => {
                const token = generateToken(userToPayload(orgOwner))
                const result = await categoriesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: token }
                )

                expect(result.totalCount).to.eq(categoriesCount)

                expect(result.pageInfo.hasNextPage).to.be.false
                expect(result.pageInfo.hasPreviousPage).to.be.false

                expect(result.edges.length).eq(categoriesCount)

                const categories = result.edges

                categories.every((category) => {
                    expect(category.node.subcategories?.length).to.eq(
                        SUMMARY_ELEMENTS_LIMIT
                    )

                    expect(category.node.subjects?.length).to.eq(
                        SUMMARY_ELEMENTS_LIMIT
                    )

                    expect(category.node.programs?.length).to.eq(
                        SUMMARY_ELEMENTS_LIMIT
                    )
                })
            })
        })

        context('duplicated linked data', () => {
            beforeEach(async () => {
                for (const subcategory of org2Subcategories) {
                    subcategory.name = 'Same Name'
                }

                for (const subject of org2Subjects) {
                    subject.name = 'Same Name'
                }

                for (const program of org2Programs) {
                    program.name = 'Same Name'
                }

                await connection.manager.save(org2Subcategories)
                await connection.manager.save(org2Subjects)
                await connection.manager.save(org2Programs)
            })

            it("categories' duplicated linked data is not shown except for subcategories", async () => {
                const token = generateToken(userToPayload(orgOwner))
                const result = await categoriesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: token }
                )

                expect(result.totalCount).to.eq(categoriesCount)

                expect(result.pageInfo.hasNextPage).to.be.false
                expect(result.pageInfo.hasPreviousPage).to.be.false

                expect(result.edges.length).eq(categoriesCount)

                const categories = result.edges
                categories.every((category) => {
                    expect(category.node.subcategories?.length).to.eq(
                        subcategoriesCount / categoriesCount
                    )

                    expect(category.node.subjects?.length).to.eq(1)
                    expect(category.node.programs?.length).to.eq(1)
                })
            })
        })
    })

    context('sorting', () => {
        it('returns categories sorted by id in and ascending order', async () => {
            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(categoriesCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns categories sorted by id in and descending order', async () => {
            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(categoriesCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns categories sorted by name in and ascending order', async () => {
            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(categoriesCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name || '')
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns categories sorted by name in and descending order', async () => {
            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(categoriesCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name || '')
            const isSorted = isStringArraySortedDescending(names)

            expect(isSorted).to.be.true
        })
    })

    context('filtering', () => {
        beforeEach(async () => {
            for (let i = 0; i < categoriesCount; i++) {
                org1Categories[i].status =
                    i % 2 ? Status.ACTIVE : Status.INACTIVE
            }

            await connection.manager.save(org1Categories)

            for (let i = 0; i < categoriesCount; i++) {
                org2Categories[i].system = !!(i % 2)
            }

            await connection.manager.save(org2Categories)
        })

        it('supports filtering by organization ID', async () => {
            const organizationId = org1.organization_id
            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: organizationId,
                },
            }

            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(categoriesCount)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(categoriesCount)

            const categories = result.edges
            const org1CategoryIds = org1Categories.map((s) => s.id)

            categories.every((category) =>
                org1CategoryIds.includes(category.node.id)
            )
        })

        it('supports filtering by category status', async () => {
            const filterStatus = Status.INACTIVE
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(categoriesCount / 2)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(categoriesCount / 2)

            const categories = result.edges

            categories.every(
                (category) => category.node.status === filterStatus
            )
        })

        it('supports filtering by category system', async () => {
            const filterSystem = true
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }

            const result = await categoriesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(categoriesCount / 2)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false

            expect(result.edges.length).eq(categoriesCount / 2)

            const categories = result.edges

            categories.every(
                (category) => category.node.system === filterSystem
            )
        })
    })
})
