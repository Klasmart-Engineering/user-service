import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
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
import {
    programsConnection,
    programsConnectionMainData,
} from '../../utils/operations/modelOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { GradeSummaryNode } from '../../../src/types/graphQL/grade'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRange'
import { School } from '../../../src/entities/school'
import { createSchool } from '../../factories/school.factory'
import { Class } from '../../../src/entities/class'
import { createClass } from '../../factories/class.factory'
import AgeRangesInitializer from '../../../src/initializers/ageRanges'
import ProgramsInitializer from '../../../src/initializers/programs'
import { AgeRangeUnit } from '../../../src/entities/ageRangeUnit'
import { CoreSubjectConnectionNode } from '../../../src/pagination/subjectsConnection'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import {
    createContextLazyLoaders,
    IDataLoaders,
} from '../../../src/loaders/setup'
import {
    loadProgramsForClass,
    programsChildConnectionResolver as classProgramsChildConnectionResolver,
} from '../../../src/schemas/class'
import { IChildPaginationArgs } from '../../../src/utils/pagination/paginate'
import { CoreProgramConnectionNode } from '../../../src/pagination/programsConnection'
import { GraphQLResolveInfo } from 'graphql'
import {
    loadProgramsForSchool,
    programsChildConnectionResolver as schoolProgramsChildConnectionResolver,
} from '../../../src/schemas/school'
import { createAdminUser } from '../../factories/user.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { checkPageInfo } from '../../acceptance/utils'
import { getConnection } from 'typeorm'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('model', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org1Programs: Program[] = []
    let org2Programs: Program[] = []
    let programs: Program[] = []
    let systemPrograms: Program[] = []
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
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()
        await ProgramsInitializer.run()
        admin = await createAdminUser().save()
        org1 = await createOrganization(admin).save()
        org2 = await createOrganization(admin).save()

        await createOrganizationMembership({
            user: admin,
            organization: org1,
        }).save()

        school = await createSchool(org1)
        class1 = await createClass([school])
        class2 = await createClass([school])

        org1Programs = []
        org2Programs = []
        programs = []
        ageRanges = []
        grades = []
        subjects = []

        for (let i = 0; i < ageRangesCount / 2; i++) {
            const ageRange = await createAgeRange(org1, i, i + 1)
            ageRange.low_value_unit = AgeRangeUnit.MONTH
            ageRange.high_value_unit = AgeRangeUnit.MONTH
            ageRanges.push(ageRange)
        }

        for (let i = 0; i < ageRangesCount / 2; i++) {
            const ageRange = await createAgeRange(org1, i, i + 1)
            ageRange.low_value_unit = AgeRangeUnit.YEAR
            ageRange.high_value_unit = AgeRangeUnit.YEAR
            ageRanges.push(ageRange)
        }

        await connection.manager.save(ageRanges)

        systemPrograms =
            (await connection.manager.find(Program, {
                where: { system: true },
            })) || []

        programs.push(...systemPrograms)

        for (let i = 0; i < gradesCount; i++) {
            const grade = await createGrade(org1)
            grades.push(grade)
        }

        await connection.manager.save(grades)

        for (let i = 0; i < subjectsCount; i++) {
            const subject = await createSubject(org1)
            subjects.push(subject)
        }

        await connection.manager.save(subjects)

        for (let i = 0; i < programsCount; i++) {
            const program = await createProgram(org1)
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
            const program = await createProgram(org2)
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

            checkPageInfo(result, programsCount * 2 + systemPrograms.length)
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

            checkPageInfo(result, programsCount * 2 + systemPrograms.length)

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

            checkPageInfo(result, programsCount * 2 + systemPrograms.length)

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

            checkPageInfo(result, programsCount * 2 + systemPrograms.length)

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

            checkPageInfo(result, programsCount * 2 + systemPrograms.length)

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

            checkPageInfo(result, programsCount)

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
            const filterValue = 'program 1'
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

            expect(result.totalCount).to.eq(
                programsCount / 2 + systemPrograms.length
            )

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
            const ageRange = ageRanges[1]
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
            const ageRange = ageRanges[2]
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
                    (subject: CoreSubjectConnectionNode) => subject.id
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

            await expect(
                programsConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )
            ).to.be.rejected
        })

        it("filters by age range from avoiding 'None Specified'", async () => {
            const lowValue = 0
            const lowValueUnit = AgeRangeUnit.YEAR
            const ageRangeFrom = {
                value: lowValue,
                unit: lowValueUnit,
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

            expect(result.totalCount).to.eq(0)
        })

        it("filters by age range to avoiding 'None Specified'", async () => {
            const highValue = 99
            const highValueUnit = AgeRangeUnit.YEAR
            const ageRangeTo = {
                value: highValue,
                unit: highValueUnit,
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

            expect(result.totalCount).to.eq(0)
        })
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await programsConnectionMainData(
                testClient,
                'FORWARD',
                { count: 10 },
                false,
                { authorization: getAdminAuthToken() }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
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
                            value: 'programsConnection',
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
            let ctx: { loaders: IDataLoaders }

            beforeEach(async () => {
                const token = { id: admin.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            const resolveForPrograms = async (classes: Class[]) => {
                const loaderResults = []
                for (const c of classes) {
                    const loaderResult = loadProgramsForClass(
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
                await resolveForPrograms([class1, class2])
                connection.logger.reset()

                await resolveForPrograms([class1])
                const dbCallsForSingleProgram = connection.logger.count
                connection.logger.reset()

                await resolveForPrograms([class1, class2])
                const dbCallsForTwoPrograms = connection.logger.count

                expect(dbCallsForSingleProgram).to.be.eq(dbCallsForTwoPrograms)
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
                    entityProperty: keyof Program,
                    fieldName: keyof CoreProgramConnectionNode
                ) => {
                    const classToCheck = class1
                    const programsToCheck = (await classToCheck.programs) as Program[]
                    const result = await loadProgramsForClass(
                        ctx,
                        classToCheck.class_id,
                        args,
                        false
                    )

                    const sorted = programsToCheck
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

        context('class parent', () => {
            let ctx: { loaders: IDataLoaders }

            beforeEach(async () => {
                const token = { id: admin.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns correct programs per class', async () => {
                const classToCheck = class1
                const programsToCheck = (await classToCheck.programs) as Program[]
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 5,
                }

                const result = await loadProgramsForClass(
                    ctx,
                    classToCheck.class_id,
                    args,
                    false
                )

                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    programsToCheck.map((p) => p.id)
                )
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) =>
                    classProgramsChildConnectionResolver(
                        { id: class1.class_id },
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
                    expect(result.totalCount).to.eq(3)
                })

                it("doesn't return total count", async () => {
                    const result = await callResolver(fakeResolverInfo)
                    expect(result.totalCount).to.eq(undefined)
                })
            })
        })

        context('school parent', async () => {
            let ctx: { loaders: IDataLoaders }

            beforeEach(async () => {
                const token = { id: admin.user_id }
                const permissions = new UserPermissions(token)
                ctx = { loaders: createContextLazyLoaders(permissions) }
            })

            it('returns correct programs per school', async () => {
                const schoolToCheck = school
                const programsToCheck = (await school.programs) as Program[]
                const args: IChildPaginationArgs = {
                    direction: 'FORWARD',
                    count: 2,
                }

                const result = await loadProgramsForSchool(
                    ctx,
                    schoolToCheck.school_id,
                    args,
                    false
                )

                expect(result.edges.map((e) => e.node.id)).to.have.same.members(
                    programsToCheck.map((p) => p.id)
                )
            })

            context('totalCount', async () => {
                const callResolver = (
                    fakeInfo: Pick<GraphQLResolveInfo, 'fieldNodes'>
                ) =>
                    schoolProgramsChildConnectionResolver(
                        { id: school.school_id },
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
    })
})
