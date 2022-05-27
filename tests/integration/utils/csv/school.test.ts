import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection, IsNull } from 'typeorm'
import { Organization } from '../../../../src/entities/organization'
import { Program } from '../../../../src/entities/program'
import { School } from '../../../../src/entities/school'
import AgeRangesInitializer from '../../../../src/initializers/ageRanges'
import CategoriesInitializer from '../../../../src/initializers/categories'
import GradesInitializer from '../../../../src/initializers/grades'
import ProgramsInitializer from '../../../../src/initializers/programs'
import SubcategoriesInitializer from '../../../../src/initializers/subcategories'
import SubjectsInitializer from '../../../../src/initializers/subjects'
import { Model } from '../../../../src/model'
import { CSVError } from '../../../../src/types/csv/csvError'
import { SchoolRow } from '../../../../src/types/csv/schoolRow'
import { createServer } from '../../../../src/utils/createServer'
import { processSchoolFromCSVRow } from '../../../../src/utils/csv/school'
import { createOrganization } from '../../../factories/organization.factory'
import { createSchool } from '../../../factories/school.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { TestConnection } from '../../../utils/testConnection'
import { User } from '@sentry/node'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { Status } from '../../../../src/entities/status'
import { customErrors } from '../../../../src/types/errors/customError'
import { config } from '../../../../src/config/config'

use(chaiAsPromised)

describe('processSchoolFromCSVRow', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let row: SchoolRow
    let organization: Organization
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions
    const sameShortcodeAnotherSchoolName = 'School One'

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        organization = await createOrganization()
        organization.organization_name = 'Company 1'
        await connection.manager.save(organization)
        await AgeRangesInitializer.run()
        await GradesInitializer.run()
        await SubjectsInitializer.run()
        await SubcategoriesInitializer.run()
        await CategoriesInitializer.run()
        await ProgramsInitializer.run()

        row = {
            organization_name: 'Company 1',
            school_name: 'School 1',
            school_shortcode: 'SCHOOL1',
            program_name: 'Math',
        }
        fileErrors = []

        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    context('when the organization name is not provided', () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const schoolRowError = rowErrors[0]

            expect(schoolRowError.code).to.equal(
                customErrors.missing_required_entity_attribute.code
            )
            expect(schoolRowError.message).to.equal(
                'On row number 1, organization name is required.'
            )

            const school = await School.findOneBy({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            expect(school).to.be.null
        })
    })

    context('when the school name is not provided', () => {
        beforeEach(() => {
            row = { ...row, school_name: '' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const schoolRowError = rowErrors[0]

            expect(schoolRowError.code).to.equal(
                customErrors.missing_required_entity_attribute.code
            )
            expect(schoolRowError.message).to.equal(
                'On row number 1, school name is required.'
            )

            const school = await School.findOneBy({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            expect(school).to.be.null
        })
    })

    context(
        'when the school name length is greater than 120 characters',
        () => {
            beforeEach(() => {
                row = {
                    ...row,
                    school_name:
                        'this is a more than one hundred twenty characters school name and this should throw an error because is too looooooooooooooooooong',
                }
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const schoolRowError = rowErrors[0]

                expect(schoolRowError.code).to.equal(
                    customErrors.invalid_max_length.code
                )
                expect(schoolRowError.message).to.equal(
                    `On row number 1, school name must not be greater than ${config.limits.SCHOOL_NAME_MAX_LENGTH} characters.`
                )

                const school = await School.findOneBy({
                    school_name: row.school_name,
                    status: Status.ACTIVE,
                    organization: {
                        organization_id: organization.organization_id,
                    },
                })

                expect(school).to.be.null
            })
        }
    )
    //Temporarily skipped due to shifting business priorities, but should be fixed
    context.skip('when the school name is just blank spaces', () => {
        beforeEach(() => {
            row = { ...row, school_name: '          ' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const schoolRowError = rowErrors[0]
            expect(schoolRowError.code).to.equal('ERR_CSV_INVALID_ALPHA_NUM')
            expect(schoolRowError.message).to.equal(
                'On row number 1, school name must only contain letters and numbers.'
            )

            const school = await School.findOneBy({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            expect(school).to.be.undefined
        })
    })

    context('when provided shortcode is not valid', () => {
        beforeEach(() => {
            row = { ...row, school_shortcode: 'SC@123' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const schoolRowError = rowErrors[0]

            expect(schoolRowError.code).to.equal(
                customErrors.invalid_alphanumeric.code
            )
            expect(schoolRowError.message).to.equal(
                `On row number 1, school shortcode must only contain letters and numbers.`
            )

            const school = await School.findOneBy({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            expect(school).to.be.null
        })
    })

    context(
        'when provided shortcode already exists in another school in the same organization',
        () => {
            beforeEach(async () => {
                const school = await createSchool(organization, 'School One')
                school.shortcode = row.school_shortcode
                await connection.manager.save(school)
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const schoolRowError = rowErrors[0]

                expect(schoolRowError.code).to.equal(
                    customErrors.existent_child_entity.code
                )
                expect(schoolRowError.message).to.equal(
                    `On row number 1, shortcode ${row.school_shortcode} already exists for school ${sameShortcodeAnotherSchoolName}.`
                )

                const school = await School.findOneBy({
                    school_name: row.school_name,
                    status: Status.ACTIVE,
                    organization: {
                        organization_id: organization.organization_id,
                    },
                })

                expect(school).to.be.null
            })
        }
    )

    context('when the program name is not provided', () => {
        beforeEach(() => {
            row = { ...row, program_name: '' }
        })

        it('It works by adding the default program', async () => {
            await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const school = await School.findOneByOrFail({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            const organizationInSchool = await school.organization

            expect(school).to.exist
            expect(school.school_name).eq(row.school_name)
            expect(school.status).eq('active')
            expect(organizationInSchool?.organization_name).eq(
                row.organization_name
            )
        })
    })

    context("when the provided organization doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Company 10' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const schoolRowError = rowErrors[0]
            expect(schoolRowError.code).to.equal(
                'ERR_CSV_INVALID_MULTIPLE_EXIST'
            )
            expect(schoolRowError.message).to.equal(
                `On row number 1, "${row.organization_name}" organization matches 0, it should match one organization.`
            )

            const school = await School.findOneBy({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            expect(school).to.be.null
        })
    })

    context("when the provided program name doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, program_name: 'non_existent_program123' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const schoolRowError = rowErrors[0]

            expect(schoolRowError.code).to.equal(
                customErrors.nonexistent_child.code
            )
            expect(schoolRowError.message).to.equal(
                `On row number 1, program ${row.program_name} doesn't exist for organization ${row.organization_name}.`
            )

            const school = await School.findOneBy({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            expect(school).to.be.null
        })
    })

    context(
        'when the provided program already exists in the current school',
        () => {
            beforeEach(async () => {
                const programs: Program[] = []
                const programFound = await Program.findOneOrFail({
                    where: {
                        name: row.program_name,
                    },
                })
                const school = new School()

                programs.push(programFound)
                school.school_name = row.school_name
                school.organization = Promise.resolve(organization)
                school.programs = Promise.resolve(programs)
                await connection.manager.save(school)
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const schoolRowError = rowErrors[0]

                expect(schoolRowError.code).to.equal(
                    customErrors.existent_child_entity.code
                )
                expect(schoolRowError.message).to.equal(
                    `On row number 1, program ${row.program_name} already exists for school ${row.school_name}.`
                )

                const school = await School.findOneBy({
                    school_name: row.school_name,
                    status: Status.ACTIVE,
                    organization: {
                        organization_id: organization.organization_id,
                    },
                })

                expect(school).to.exist
            })
        }
    )

    context('when all data provided is valid', () => {
        it('creates the schools with its relations', async () => {
            await processSchoolFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const school = await School.findOneByOrFail({
                school_name: row.school_name,
                status: Status.ACTIVE,
                organization: { organization_id: organization.organization_id },
            })

            const programDB = await connection.manager.findOneByOrFail(
                Program,
                {
                    name: row.program_name,
                    system: true,
                    organization: IsNull(),
                }
            )

            const organizationInSchool = await school.organization
            const programsInSchool = (await school.programs) || []

            const EntityInfo = (entityValue: any) => {
                return entityValue
            }

            expect(school).to.exist
            expect(school.school_name).eq(row.school_name)
            expect(school.shortcode).eq(row.school_shortcode)
            expect(school.status).eq('active')
            expect(organizationInSchool?.organization_name).eq(
                row.organization_name
            )
            expect(programsInSchool.map(EntityInfo)).to.deep.eq([
                EntityInfo(programDB),
            ])
        })

        context(
            'and the shortcode is duplicated in another organization',
            () => {
                beforeEach(async () => {
                    const secondOrg = createOrganization()
                    await connection.manager.save(secondOrg)

                    const secondSchool = createSchool(
                        secondOrg,
                        'second-school'
                    )
                    secondSchool.shortcode = 'DUP456'
                    await connection.manager.save(secondSchool)

                    row = { ...row, school_shortcode: secondSchool.shortcode }
                })

                it('creates the school with its relations', async () => {
                    await processSchoolFromCSVRow(
                        connection.manager,
                        row,
                        1,
                        fileErrors,
                        adminPermissions
                    )

                    const school = await School.findOneByOrFail({
                        school_name: row.school_name,
                        status: Status.ACTIVE,
                        organization: {
                            organization_id: organization.organization_id,
                        },
                    })

                    const programDB = await connection.manager.findOneByOrFail(
                        Program,
                        {
                            name: row.program_name,
                            system: true,
                            organization: IsNull(),
                        }
                    )

                    const organizationInSchool = await school.organization
                    const programsInSchool = (await school.programs) || []

                    const EntityInfo = (entityValue: any) => {
                        return entityValue
                    }

                    expect(school).to.exist
                    expect(school.school_name).eq(row.school_name)
                    expect(school.shortcode).eq(row.school_shortcode)
                    expect(school.status).eq('active')
                    expect(organizationInSchool?.organization_name).eq(
                        row.organization_name
                    )
                    expect(programsInSchool.map(EntityInfo)).to.deep.eq([
                        EntityInfo(programDB),
                    ])
                })
            }
        )
    })
})
