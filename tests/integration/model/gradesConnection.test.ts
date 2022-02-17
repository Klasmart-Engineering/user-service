import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Context } from 'mocha'
import { getConnection } from 'typeorm'
import { Class } from '../../../src/entities/class'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import GradesInitializer from '../../../src/initializers/grades'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Model } from '../../../src/model'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { loadGradesForClass } from '../../../src/schemas/class'
import { loadGradesForProgram } from '../../../src/schemas/program'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createClass } from '../../factories/class.factory'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createProgram } from '../../factories/program.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    gradesConnection,
    gradesConnectionMainData,
} from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { getAdminAuthToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import { checkPageInfo } from '../../acceptance/utils'

use(chaiAsPromised)

describe('model', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org1Grades: Grade[] = []
    let org2Grades: Grade[] = []
    let grades: Grade[] = []
    let systemGrades: Grade[] = []

    const gradesCount = 12

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        await GradesInitializer.run()

        systemGrades = await Grade.find({
            where: { system: true, status: 'active' },
        })

        admin = await createAdminUser(testClient)
        org1 = await createOrganization(admin)
        org2 = await createOrganization(admin)
        await connection.manager.save([org1, org2])
        org1Grades = []
        org2Grades = []
        grades = []

        for (let i = 0; i < gradesCount; i++) {
            const grade = await createGrade(
                org1,
                systemGrades[i],
                systemGrades[i + 1]
            )
            grade.name = `grade ${i}`
            grade.status = Status.ACTIVE
            org1Grades.push(grade)
        }

        for (let i = 0; i < gradesCount; i++) {
            const grade = await createGrade(
                org2,
                systemGrades[i],
                systemGrades[i + 1]
            )
            grade.name = `grade ${i}`
            grade.status = Status.INACTIVE
            org2Grades.push(grade)
        }

        grades.push(...org1Grades, ...org2Grades)

        await connection.manager.save(grades)
    })

    context('pagination', () => {
        it('returns grades from all the list', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            checkPageInfo(result, gradesCount * 2 + systemGrades.length)
        })
    })

    context('sorting', () => {
        it('returns grades sorted by id in an ascending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            checkPageInfo(result, gradesCount * 2 + systemGrades.length)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns grades sorted by id in a descending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )
            checkPageInfo(result, gradesCount * 2 + systemGrades.length)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns grades sorted by name in an ascending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'ASC' }
            )

            checkPageInfo(result, gradesCount * 2 + systemGrades.length)

            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns grades sorted by name in an descending order', async () => {
            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'DESC' }
            )

            checkPageInfo(result, gradesCount * 2 + systemGrades.length)

            const names = result.edges.map((edge) => edge.node.name) as string[]
            const isSorted = isStringArraySortedDescending(names)

            expect(isSorted).to.be.true
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

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            checkPageInfo(result, gradesCount)

            const gradeIds = result.edges.map((edge) => edge.node.id)
            const org1GradeIds = org1Grades.map((grade) => grade.id)
            gradeIds.every((id) => org1GradeIds.includes(id))
        })

        it('supports filtering by grade ID', async () => {
            const gradeId = grades[0].id
            const filter: IEntityFilter = {
                id: {
                    operator: 'eq',
                    value: gradeId,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)

            const gradeIds = result.edges.map((edge) => edge.node.id)
            gradeIds.every((id) => id === gradeId)
        })

        it('supports filtering by grade name', async () => {
            const filterValue = '8'
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: filterValue,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(2)

            const names = result.edges.map((edge) => edge.node.name)
            names.every((name) => name?.includes(filterValue))
        })

        it('supports filtering by grade status', async () => {
            const filterStatus = 'inactive'
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(gradesCount)

            const statuses = result.edges.map((edge) => edge.node.status)
            statuses.every((status) => status === filterStatus)
        })

        it('supports filtering by grade system', async () => {
            const filterSystem = true
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(systemGrades.length)

            const systems = result.edges.map((edge) => edge.node.system)
            systems.every((system) => system === filterSystem)
        })

        it('supports filtering by from grade ID', async () => {
            const fromGradeId = systemGrades[4].id
            const filter: IEntityFilter = {
                fromGradeId: {
                    operator: 'eq',
                    value: fromGradeId,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(2)

            const fromGradeIds = result.edges.map((edge) => {
                return edge.node.fromGrade.id
            })

            fromGradeIds.every((ids) => ids.includes(fromGradeId))
        })

        it('supports filtering by to grade ID', async () => {
            const toGradeId = systemGrades[5].id
            const filter: IEntityFilter = {
                toGradeId: {
                    operator: 'eq',
                    value: toGradeId,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(2)

            const toGradeIds = result.edges.map((edge) => {
                return edge.node.fromGrade.id
            })

            toGradeIds.every((ids) => ids.includes(toGradeId))
        })

        it('supports filtering by program ID', async () => {
            const programGrades = org1Grades.slice(0, 2)
            const program = await createProgram(org1, [], programGrades).save()
            const filter: IEntityFilter = {
                programId: {
                    operator: 'eq',
                    value: program.id,
                },
            }

            const result = await gradesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(result.totalCount).to.eq(2)
            expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                programGrades.map((g) => g.id)
            )
        })

        it('fails if search value is longer than 250 characters', async () => {
            const longValue =
                'hOfLDx5hwPm1KnwNEaAHUddKjN62yGEk4ZycRB7UjmZXMtm2ODnQCycCmylMDsVDCztWgrepOaQ9itKx94g2rELPj8w533bGpKqUT9a25NuKrzs5R3OfTUprOkCLE1PBHYOAUpSU289e4BhZzR40ncGsKwKtIFHQ9fzy1hlPr3gWMK8H6s5JGtO0oQrl8Lf0co5IlKWRaeEY4eaUUIWVHRiSdsaaXgM5ffW1zgZCrhOYCPZrBrP8uYaiPGsn1GjE8Chf'
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: longValue,
                },
            }

            await expect(
                gradesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )
            ).to.be.rejected
        })
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await gradesConnectionMainData(
                testClient,
                'FORWARD',
                { count: 10 },
                false,
                { authorization: getAdminAuthToken() }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })
    context('gradesConnectionChild', () => {
        let ctx: Pick<Context, 'loaders'>
        let clientUser: User
        let allGrades: Grade[]

        beforeEach(async () => {
            allGrades = [
                await createGrade().save(),
                await createGrade().save(),
                await createGrade().save(),
            ]
            clientUser = await createAdminUser(testClient)
            const userPermissions = new UserPermissions(
                userToPayload(clientUser)
            )
            ctx = { loaders: createContextLazyLoaders(userPermissions) }
        })
        context('as a child of programs', () => {
            let program: Program
            let programGrades: Grade[]
            beforeEach(async () => {
                programGrades = [allGrades[0], allGrades[1]]
                program = await createProgram(
                    undefined,
                    undefined,
                    programGrades
                ).save()
            })
            it('returns grades per program', async () => {
                const result = await loadGradesForProgram(
                    program.id,
                    {},
                    ctx.loaders,
                    true
                )
                expect(result.totalCount).to.eq(2)
                expect(result.edges.length).to.eq(2)
                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    programGrades.map((g) => g.id)
                )
            })
        })
        context('as a child of classes', () => {
            let class_: Class
            let classGrades: Grade[]
            beforeEach(async () => {
                classGrades = [allGrades[0], allGrades[1]]
                class_ = await createClass()
                class_.grades = Promise.resolve(classGrades)
                await class_.save()
            })
            it('returns grades per class', async () => {
                const result = await loadGradesForClass(
                    class_.class_id,
                    {},
                    ctx.loaders,
                    true
                )
                expect(result.totalCount).to.eq(2)
                expect(result.edges.length).to.eq(2)
                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    classGrades.map((g) => g.id)
                )
            })
        })
        it('uses exactly one dataloader when called with different parents', async () => {
            const programs = [
                await createProgram(undefined, undefined, [
                    allGrades[0],
                ]).save(),
                await createProgram(undefined, undefined, [
                    allGrades[1],
                ]).save(),
            ]

            connection.logger.reset()
            const loaderResults = []
            for (const program of programs) {
                loaderResults.push(
                    loadGradesForProgram(program.id, {}, ctx.loaders, false)
                )
            }
            await Promise.all(loaderResults)
            expect(connection.logger.count).to.be.eq(1)
        })
        context('sorting', () => {
            let program: Program
            beforeEach(async () => {
                program = await createProgram(
                    undefined,
                    undefined,
                    allGrades
                ).save()
            })
            it('sorts by grade id', async () => {
                const result = await loadGradesForProgram(
                    program.id,
                    {
                        sort: {
                            field: 'id',
                            order: 'ASC',
                        },
                    },
                    ctx.loaders,
                    true
                )
                expect(result.edges.map((e) => e.node.id)).to.deep.equal(
                    allGrades.map((g) => g.id).sort()
                )
            })
            it('sorts by grade name', async () => {
                const result = await loadGradesForProgram(
                    program.id,
                    {
                        sort: {
                            field: 'name',
                            order: 'ASC',
                        },
                    },
                    ctx.loaders,
                    true
                )
                expect(
                    result.edges.map((e) => e.node.name?.toLowerCase())
                ).to.deep.equal(
                    allGrades.map((g) => g.name?.toLowerCase()).sort()
                )
            })
        })
        context('totalCount', () => {
            let program: Program
            let programGrades: Grade[]
            beforeEach(async () => {
                programGrades = [allGrades[0], allGrades[1]]
                program = await createProgram(
                    undefined,
                    undefined,
                    programGrades
                ).save()
            })
            it('returns total count when requested', async () => {
                connection.logger.reset()
                const result = await loadGradesForProgram(
                    program.id,
                    {},
                    ctx.loaders,
                    true
                )
                expect(result.totalCount).to.eq(2)
                expect(connection.logger.count).to.be.eq(2)
            })
            it('omits total count response &  calculation when not requested', async () => {
                connection.logger.reset()
                const result = await loadGradesForProgram(
                    program.id,
                    {},
                    ctx.loaders,
                    false
                )
                expect(result.totalCount).to.undefined
                expect(connection.logger.count).to.be.eq(1)
            })
        })
    })
})
