import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { Connection } from 'typeorm'
import { AgeRange } from '../../../src/entities/ageRange'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { Status } from '../../../src/entities/status'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createProgram } from '../../factories/program.factory'
import { createSubject } from '../../factories/subject.factory'
import { programsConnection } from '../../utils/operations/modelOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import { createTestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { GradeSummaryNode } from '../../../src/types/graphQL/gradeSummaryNode'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRangeConnectionNode'
import { SubjectSummaryNode } from '../../../src/types/graphQL/subjectSummaryNode'
import { School } from '../../../src/entities/school'
import { createSchool } from '../../factories/school.factory'
import { Class } from '../../../src/entities/class'
import { createClass } from '../../factories/class.factory'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('model', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org1Programs: Program[] = []
    let org2Programs: Program[] = []
    let programs: Program[] = []
    let ageRanges: AgeRange[] = []
    let grades: Grade[] = []
    let subjects: Subject[] = []
    let school: School
    let class1: Class
    let class2: Class

    const programsCount = 12
    const ageRangesCount = 6
    const gradesCount = 4
    const subjectsCount = 3

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        admin = await createAdminUser(testClient)
        org1 = await createOrganization({}, admin).save()
        org2 = await createOrganization({}, admin).save()

        school = await createSchool(org1)
        class1 = await createClass([school])
        class2 = await createClass([school])

        org1Programs = []
        org2Programs = []
        programs = []
        ageRanges = []
        grades = []
        subjects = []

        for (let i = 0; i < ageRangesCount; i++) {
            let ageRange = await createAgeRange(
                { low_value: i, high_value: i + 1 },
                org1
            )
            ageRanges.push(ageRange)
        }

        await connection.manager.save(ageRanges)

        for (let i = 0; i < gradesCount; i++) {
            let grade = await createGrade(org1).save()
        }

        await connection.manager.save(grades)

        for (let i = 0; i < subjectsCount; i++) {
            let subject = await createSubject(org1)
            subjects.push(subject)
        }

        await connection.manager.save(subjects)

        for (let i = 0; i < programsCount; i++) {
            let program = await createProgram(org1)
            program.name = `program ${i}`
            program.age_ranges = Promise.resolve([
                ageRanges[Math.floor(i / (programsCount / ageRangesCount))],
            ])
            program.grades = Promise.resolve([
                grades[Math.floor(i / (programsCount / gradesCount))],
            ])
            program.subjects = Promise.resolve([
                subjects[Math.floor(i / (programsCount / subjectsCount))],
            ])
            program.system = i % 2 === 0
            program.status = Status.ACTIVE
            org1Programs.push(program)
        }

        for (let i = 0; i < programsCount; i++) {
            let program = await createProgram(org2)
            program.name = `program ${i}`
            program.status = Status.INACTIVE
            org2Programs.push(program)
        }

        programs.push(...org1Programs, ...org2Programs)

        await connection.manager.save(programs)

        school.programs = Promise.resolve([org1Programs[0]])
        await connection.manager.save(school)

        class1.programs = Promise.resolve([
            org1Programs[1],
            org1Programs[3],
            org1Programs[5],
        ])

        class2.programs = Promise.resolve([
            org1Programs[0],
            org1Programs[2],
            org1Programs[4],
        ])

        await connection.manager.save([class1, class2])
    })

    context('pagination', () => {
        it('returns programs from all the list', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)
        })
    })

    context('sorting', () => {
        it('returns programs sorted by id in an ascending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns programs sorted by id in a descending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns programs sorted by name in an ascending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name!)
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns programs sorted by name in a descending order', async () => {
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(programsCount * 2)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name!)
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

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const programIds = result.edges.map((edge) => edge.node.id)
            const org1ProgramIds = org1Programs.map((program) => program.id)
            programIds.every((id) => org1ProgramIds.includes(id))
        })

        it('supports filtering by program ID', async () => {
            const programId = programs[0].id
            const filter: IEntityFilter = {
                id: {
                    operator: 'eq',
                    value: programId,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)

            const programIds = result.edges.map((edge) => edge.node.id)
            programIds.every((id) => id === programId)
        })

        it('supports filtering by program name', async () => {
            const filterValue = '1'
            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: filterValue,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(6)

            const names = result.edges.map((edge) => edge.node.name) as string[]
            names.every((name) => name.includes(filterValue))
        })

        it('supports filtering by program status', async () => {
            const filterStatus = 'inactive'
            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount)

            const statuses = result.edges.map((edge) => edge.node.status)
            statuses.every((status) => status === filterStatus)
        })

        it('supports filtering by program system', async () => {
            const filterSystem = true
            const filter: IEntityFilter = {
                system: {
                    operator: 'eq',
                    value: filterSystem,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount / 2)

            const systems = result.edges.map((edge) => edge.node.system)
            systems.every((system) => system === filterSystem)
        })

        it('supports filtering by grade ID', async () => {
            const gradeId = grades[0].id
            const filter: IEntityFilter = {
                gradeId: {
                    operator: 'eq',
                    value: gradeId,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(3)

            const gradesIds = result.edges.map((edge) => {
                return edge.node.grades?.map(
                    (grade: GradeSummaryNode) => grade.id
                )
            })

            gradesIds.every((ids) => ids?.includes(gradeId))
        })

        it('supports filtering by age range from', async () => {
            const ageRange = ageRanges[0]
            const ageRangeFrom = {
                value: ageRange.low_value,
                unit: ageRange.low_value_unit,
            }

            const filter: IEntityFilter = {
                ageRangeFrom: {
                    operator: 'eq',
                    value: ageRangeFrom,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount / ageRangesCount)

            const ageRangesValues = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.lowValue
                )
            })

            const ageRangesUnits = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.lowValueUnit
                )
            })

            ageRangesValues.every((values) =>
                values?.includes(ageRangeFrom.value)
            )
            ageRangesUnits.every((units) => units?.includes(ageRangeFrom.unit))
        })

        it('supports filtering by age range to', async () => {
            const ageRange = ageRanges[1]
            const ageRangeTo = {
                value: ageRange.high_value,
                unit: ageRange.high_value_unit,
            }

            const filter: IEntityFilter = {
                ageRangeTo: {
                    operator: 'eq',
                    value: ageRangeTo,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(programsCount / ageRangesCount)

            const ageRangesValues = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.highValue
                )
            })

            const ageRangesUnits = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.highValueUnit
                )
            })

            ageRangesValues.every((values) =>
                values?.includes(ageRangeTo.value)
            )
            ageRangesUnits.every((units) => units?.includes(ageRangeTo.unit))
        })

        it('supports filtering by subject ID', async () => {
            const subjectId = subjects[0].id
            const filter: IEntityFilter = {
                subjectId: {
                    operator: 'eq',
                    value: subjectId,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(4)

            const subjectsIds = result.edges.map((edge) => {
                return edge.node.subjects?.map(
                    (subject: SubjectSummaryNode) => subject.id
                )
            })

            subjectsIds.every((ids) => ids?.includes(subjectId))
        })

        it('supports filtering by school ID', async () => {
            const schoolId = school.school_id
            const filter: IEntityFilter = {
                schoolId: {
                    operator: 'eq',
                    value: schoolId,
                },
            }
            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(result.totalCount).to.eq(1)
        })

        it('supports filtering by class ID', async () => {
            const classId = class1.class_id
            const filter: IEntityFilter = {
                classId: {
                    operator: 'eq',
                    value: classId,
                },
            }

            const result = await programsConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(3)

            const programIds = result.edges.map((edge) => {
                return edge.node.id
            })

            const DBClass = await connection.manager.findOne(Class, {
                where: { class_id: classId },
            })

            const classProgramIds =
                (await DBClass?.programs)?.map((program) => {
                    return program.id
                }) || []

            expect(programIds).to.deep.equalInAnyOrder(classProgramIds)
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

            const fn = () =>
                programsConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )

            expect(fn()).to.be.rejected
        })
    })
})
