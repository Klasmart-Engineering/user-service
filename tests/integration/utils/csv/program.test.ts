import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Equal, getConnection } from 'typeorm'
import { AgeRange } from '../../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../../src/entities/ageRangeUnit'
import { Grade } from '../../../../src/entities/grade'
import { Organization } from '../../../../src/entities/organization'
import { Program } from '../../../../src/entities/program'
import { Subject } from '../../../../src/entities/subject'
import { Model } from '../../../../src/model'
import { CSVError } from '../../../../src/types/csv/csvError'
import { ProgramRow } from '../../../../src/types/csv/programRow'
import { createServer } from '../../../../src/utils/createServer'
import { processProgramFromCSVRow } from '../../../../src/utils/csv/program'
import { createAgeRange } from '../../../factories/ageRange.factory'
import { createGrade } from '../../../factories/grade.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { createSubject } from '../../../factories/subject.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { TestConnection } from '../../../utils/testConnection'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { Status } from '../../../../src/entities/status'

use(chaiAsPromised)

describe('processProgramFromCSVRow', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let row: ProgramRow
    let organization: Organization
    let ageRange: AgeRange
    let grade: Grade
    let subject: Subject
    let noneSpecifiedAgeRange: AgeRange
    let noneSpecifiedGrade: Grade
    let noneSpecifiedSubject: Subject
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions
    const rowModel: ProgramRow = {
        organization_name: 'Company 1',
        program_name: 'Program 1',
        age_range_low_value: '6',
        age_range_high_value: '7',
        age_range_unit: AgeRangeUnit.YEAR,
        grade_name: 'First Grade',
        subject_name: 'Subject 1',
    }

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        row = rowModel
        fileErrors = []

        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })

        organization = await createOrganization()
        organization.organization_name = rowModel.organization_name
        await connection.manager.save(organization)

        ageRange = await createAgeRange(organization)
        ageRange.name = `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`
        ageRange.low_value = Number(rowModel.age_range_low_value)
        ageRange.high_value = Number(rowModel.age_range_high_value)
        ageRange.high_value_unit = rowModel.age_range_unit as AgeRangeUnit
        ageRange.low_value_unit = rowModel.age_range_unit as AgeRangeUnit
        await connection.manager.save(ageRange)

        grade = await createGrade(organization)
        grade.name = rowModel.grade_name
        await connection.manager.save(grade)

        subject = await createSubject(organization)
        subject.name = rowModel.subject_name
        await connection.manager.save(subject)

        noneSpecifiedAgeRange = new AgeRange()
        noneSpecifiedAgeRange.name = 'None Specified'
        noneSpecifiedAgeRange.low_value = 0
        noneSpecifiedAgeRange.high_value = 99
        noneSpecifiedAgeRange.low_value_unit = AgeRangeUnit.YEAR
        noneSpecifiedAgeRange.high_value_unit = AgeRangeUnit.YEAR
        noneSpecifiedAgeRange.system = true
        await connection.manager.save(noneSpecifiedAgeRange)

        noneSpecifiedGrade = new Grade()
        noneSpecifiedGrade.name = 'None Specified'
        noneSpecifiedGrade.system = true
        await connection.manager.save(noneSpecifiedGrade)

        noneSpecifiedSubject = new Subject()
        noneSpecifiedSubject.name = 'None Specified'
        noneSpecifiedSubject.system = true
        await connection.manager.save(noneSpecifiedSubject)
    })

    context('when the organization name is not provided', () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(programRowError.message).to.equal(
                'On row number 1, organization name is required.'
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context('when the program name is not provided', () => {
        beforeEach(() => {
            row = { ...row, program_name: '' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(programRowError.message).to.equal(
                'On row number 1, program name is required.'
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context('when not all the age range values are provided', () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: '' as AgeRangeUnit }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal(
                'ERR_PROGRAM_AGE_RANGE_FIELD_EXIST'
            )
            expect(programRowError.message).to.equal(
                'On row number 1, program must exist age_range_high_value, age_range_low_value, age_range_unit or none of them.'
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context('when age range high value is not a valid number', () => {
        beforeEach(() => {
            row = { ...row, age_range_high_value: '100.5d' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_INVALID_BETWEEN')
            expect(programRowError.message).to.equal(
                'On row number 1, ageRange age_range_high_value must be between 1 and 99.'
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context('when age range low value is not a valid number', () => {
        beforeEach(() => {
            row = { ...row, age_range_low_value: '100.5d' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_INVALID_BETWEEN')
            expect(programRowError.message).to.equal(
                'On row number 1, ageRange age_range_low_value must be between 0 and 99.'
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context(
        'when age range low value is greater than age range high value',
        () => {
            beforeEach(() => {
                row = {
                    ...row,
                    age_range_low_value: String(
                        Number(row.age_range_high_value) + 1
                    ),
                }
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const programRowError = rowErrors[0]
                expect(programRowError.code).to.equal(
                    'ERR_CSV_INVALID_GREATER_THAN_OTHER'
                )
                expect(programRowError.message).to.equal(
                    'On row number 1, ageRange age_range_high_value must be greater than age_range_low_value.'
                )

                const program = await Program.findOneBy({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                expect(program).to.be.undefined
            })
        }
    )

    context('when age range unit value is invalid', () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: 'week' as AgeRangeUnit }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_INVALID_ENUM')
            expect(programRowError.message).to.equal(
                'On row number 1, ageRange age_range_unit must be one of these: month, year.'
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context("when provided organization doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Organization 2' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_NONE_EXIST_ENTITY')
            expect(programRowError.message).to.equal(
                `On row number 1, "${row.organization_name}" organization doesn't exist.`
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context("when provided age range doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: AgeRangeUnit.MONTH }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal(
                'ERR_CSV_NONE_EXIST_CHILD_ENTITY'
            )
            expect(programRowError.message).to.equal(
                `On row number 1, "6 - 7 month(s)" ageRange doesn't exist for "${rowModel.organization_name}" organization.`
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context("when provided grade doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, grade_name: 'Second Grade' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal(
                'ERR_CSV_NONE_EXIST_CHILD_ENTITY'
            )
            expect(programRowError.message).to.equal(
                `On row number 1, "${row.grade_name}" grade doesn't exist for "${rowModel.organization_name}" organization.`
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context("when provided subject doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, subject_name: 'Subject 2' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processProgramFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal(
                'ERR_CSV_NONE_EXIST_CHILD_ENTITY'
            )
            expect(programRowError.message).to.equal(
                `On row number 1, "${row.subject_name}" subject doesn't exist for "${rowModel.organization_name}" organization.`
            )

            const program = await Program.findOneBy({
                name: row.program_name,
                status: Status.ACTIVE,
                system: false,
                organization: Equal(organization),
            })

            expect(program).to.be.undefined
        })
    })

    context(
        'when provided age range already exists in the provided program',
        () => {
            beforeEach(async () => {
                const ageRanges: AgeRange[] = []
                ageRanges.push(ageRange)

                const program = new Program()
                program.name = row.program_name
                program.organization = Promise.resolve(organization)
                program.age_ranges = Promise.resolve(ageRanges)
                await connection.manager.save(program)
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const programRowError = rowErrors[0]
                expect(programRowError.code).to.equal(
                    'ERR_CSV_DUPLICATE_CHILD_ENTITY'
                )
                expect(programRowError.message).to.equal(
                    `On row number 1, "6 - 7 year(s)" ageRange already exists for "${rowModel.program_name}" program.`
                )

                const program = await Program.findOneBy({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                expect(program).to.exist
            })
        }
    )

    context(
        'when provided grade already exists in the provided program',
        () => {
            beforeEach(async () => {
                const grades: Grade[] = []
                grades.push(grade)

                const program = new Program()
                program.name = row.program_name
                program.organization = Promise.resolve(organization)
                program.grades = Promise.resolve(grades)
                await connection.manager.save(program)
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const programRowError = rowErrors[0]
                expect(programRowError.code).to.equal(
                    'ERR_CSV_DUPLICATE_CHILD_ENTITY'
                )
                expect(programRowError.message).to.equal(
                    `On row number 1, "${rowModel.grade_name}" grade already exists for "${rowModel.program_name}" program.`
                )

                const program = await Program.findOneBy({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                expect(program).to.exist
            })
        }
    )

    context(
        'when provided subject already exists in the provided program',
        () => {
            beforeEach(async () => {
                const subjects: Subject[] = []
                subjects.push(subject)

                const program = new Program()
                program.name = row.program_name
                program.organization = Promise.resolve(organization)
                program.subjects = Promise.resolve(subjects)
                await connection.manager.save(program)
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const programRowError = rowErrors[0]
                expect(programRowError.code).to.equal(
                    'ERR_CSV_DUPLICATE_CHILD_ENTITY'
                )
                expect(programRowError.message).to.equal(
                    `On row number 1, "${rowModel.subject_name}" subject already exists for "${rowModel.program_name}" program.`
                )

                const program = await Program.findOneBy({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                expect(program).to.exist
            })
        }
    )

    context('when all data provided is valid', () => {
        context('and all fields are provided', () => {
            it('creates a program with its relations', async () => {
                await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const program = await Program.findOneByOrFail({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                const ageRangeDB = await connection.manager.findOneByOrFail(
                    AgeRange,
                    { id: ageRange.id }
                )
                const gradeDB = await connection.manager.findOneByOrFail(
                    Grade,
                    { id: grade.id }
                )
                const subjectDB = await connection.manager.findOneByOrFail(
                    Subject,
                    { id: subject.id }
                )

                const organizationInProgram = await program.organization
                const ageRangesInProgram = (await program.age_ranges) || []
                const gradesInProgram = (await program.grades) || []
                const subjectsInProgram = (await program.subjects) || []

                const EntityInfo = (entityValue: any) => {
                    return entityValue
                }

                expect(program).to.exist
                expect(program.name).eq(row.program_name)
                expect(program.system).eq(false)
                expect(program.status).eq('active')
                expect(organizationInProgram?.organization_id).eq(
                    organization.organization_id
                )
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(ageRangeDB),
                ])
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(gradeDB),
                ])
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(subjectDB),
                ])
            })
        })

        context('and age range is not provided', () => {
            beforeEach(async () => {
                row = {
                    ...row,
                    program_name: 'Program 2',
                    age_range_low_value: '',
                    age_range_high_value: '',
                    age_range_unit: '' as AgeRangeUnit,
                }
            })

            it("creates a program with 'None Specified' age range", async () => {
                await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const program = await Program.findOneByOrFail({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                const ageRangeDB = await connection.manager.findOneByOrFail(
                    AgeRange,
                    { id: noneSpecifiedAgeRange.id }
                )
                const gradeDB = await connection.manager.findOneByOrFail(
                    Grade,
                    { id: grade.id }
                )
                const subjectDB = await connection.manager.findOneByOrFail(
                    Subject,
                    { id: subject.id }
                )

                const organizationInProgram = await program.organization
                const ageRangesInProgram = (await program.age_ranges) || []
                const gradesInProgram = (await program.grades) || []
                const subjectsInProgram = (await program.subjects) || []

                const EntityInfo = (entityValue: any) => {
                    return entityValue
                }

                expect(program).to.exist
                expect(program.name).eq(row.program_name)
                expect(program.system).eq(false)
                expect(program.status).eq('active')
                expect(organizationInProgram?.organization_id).eq(
                    organization.organization_id
                )
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(ageRangeDB),
                ])
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(gradeDB),
                ])
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(subjectDB),
                ])
            })
        })

        context('and grade is not provided', () => {
            beforeEach(async () => {
                row = { ...row, program_name: 'Program 3', grade_name: '' }
            })

            it("creates a program with 'None Specified' grade", async () => {
                await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const program = await Program.findOneByOrFail({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                const ageRangeDB = await connection.manager.findOneByOrFail(
                    AgeRange,
                    { id: ageRange.id }
                )
                const gradeDB = await connection.manager.findOneByOrFail(
                    Grade,
                    { id: noneSpecifiedGrade.id }
                )
                const subjectDB = await connection.manager.findOneByOrFail(
                    Subject,
                    { id: subject.id }
                )

                const organizationInProgram = await program.organization
                const ageRangesInProgram = (await program.age_ranges) || []
                const gradesInProgram = (await program.grades) || []
                const subjectsInProgram = (await program.subjects) || []

                const EntityInfo = (entityValue: any) => {
                    return entityValue
                }

                expect(program).to.exist
                expect(program.name).eq(row.program_name)
                expect(program.system).eq(false)
                expect(program.status).eq('active')
                expect(organizationInProgram?.organization_id).eq(
                    organization.organization_id
                )
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(ageRangeDB),
                ])
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(gradeDB),
                ])
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(subjectDB),
                ])
            })
        })

        context('and subject is not provided', () => {
            beforeEach(async () => {
                row = { ...row, program_name: 'Program 4', subject_name: '' }
            })

            it("creates a program with 'None Specified' subject", async () => {
                await processProgramFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const program = await Program.findOneByOrFail({
                    name: row.program_name,
                    status: Status.ACTIVE,
                    system: false,
                    organization: Equal(organization),
                })

                const ageRangeDB = await connection.manager.findOneByOrFail(
                    AgeRange,
                    { id: ageRange.id }
                )
                const gradeDB = await connection.manager.findOneByOrFail(
                    Grade,
                    { id: grade.id }
                )
                const subjectDB = await connection.manager.findOneByOrFail(
                    Subject,
                    { id: noneSpecifiedSubject.id }
                )

                const organizationInProgram = await program.organization
                const ageRangesInProgram = (await program.age_ranges) || []
                const gradesInProgram = (await program.grades) || []
                const subjectsInProgram = (await program.subjects) || []

                const EntityInfo = (entityValue: any) => {
                    return entityValue
                }

                expect(program).to.exist
                expect(program.name).eq(row.program_name)
                expect(program.system).eq(false)
                expect(program.status).eq('active')
                expect(organizationInProgram?.organization_id).eq(
                    organization.organization_id
                )
                expect(ageRangesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(ageRangeDB),
                ])
                expect(gradesInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(gradeDB),
                ])
                expect(subjectsInProgram.map(EntityInfo)).to.deep.eq([
                    EntityInfo(subjectDB),
                ])
            })
        })
    })
})
