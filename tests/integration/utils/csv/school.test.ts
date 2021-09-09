import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
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
import { createTestConnection } from '../../../utils/testConnection'
import { User } from '@sentry/node'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'

use(chaiAsPromised)

describe('processSchoolFromCSVRow', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let row: SchoolRow
    let organization: Organization
    let fileErrors: CSVError[] = []
    let adminUser: User
    let adminPermissions: UserPermissions

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
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

        it('throws an error', async () => {
            await expect(
                processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.be.rejected
            const school = await School.findOne({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
            })

            expect(school).to.be.undefined
        })
    })

    context('when the school name is not provided', () => {
        beforeEach(() => {
            row = { ...row, school_name: '' }
        })

        it('throws an error', async () => {
            await expect(
                processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.be.rejected
            const school = await School.findOne({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
            })

            expect(school).to.be.undefined
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

            it('throws an error', async () => {
                await expect(
                    processSchoolFromCSVRow(
                        connection.manager,
                        row,
                        1,
                        fileErrors,
                        adminPermissions
                    )
                ).to.be.rejected
                const school = await School.findOne({
                    where: {
                        school_name: row.school_name,
                        status: 'active',
                        organization,
                    },
                })

                expect(school).to.be.undefined
            })
        }
    )

    context('when the school name length is just blank spaces', () => {
        beforeEach(() => {
            row = { ...row, school_name: '          ' }
        })

        it('throws an error', async () => {
            await expect(
                processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.be.rejected
            const school = await School.findOne({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
            })

            expect(school).to.be.undefined
        })
    })

    context('when provided shortcode is not valid', () => {
        beforeEach(() => {
            row = { ...row, school_shortcode: 'SC@123' }
        })

        it('throws an error', async () => {
            await expect(
                processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.be.rejected
            const school = await School.findOne({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
            })

            expect(school).to.be.undefined
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

            it('throws an error', async () => {
                await expect(
                    processSchoolFromCSVRow(
                        connection.manager,
                        row,
                        1,
                        fileErrors,
                        adminPermissions
                    )
                ).to.be.rejected
                const school = await School.findOne({
                    where: {
                        school_name: row.school_name,
                        status: 'active',
                        organization,
                    },
                })

                expect(school).to.be.undefined
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

            const school = await School.findOneOrFail({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
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

    context("when the provided organization doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Company 10' }
        })

        it('throws an error', async () => {
            await expect(
                processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.be.rejected
            const school = await School.findOne({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
            })

            expect(school).to.be.undefined
        })
    })

    context("when the provided program name doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, program_name: 'non_existent_program123' }
        })

        it('throws an error', async () => {
            await expect(
                processSchoolFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
            ).to.be.rejected
            const school = await School.findOne({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
            })

            expect(school).to.be.undefined
        })
    })

    context(
        'when the provided program already exists in the current school',
        () => {
            beforeEach(async () => {
                let programs: Program[] = []
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

            it('throws an error', async () => {
                await expect(
                    processSchoolFromCSVRow(
                        connection.manager,
                        row,
                        1,
                        fileErrors,
                        adminPermissions
                    )
                ).to.be.rejected
                const school = await School.findOne({
                    where: {
                        school_name: row.school_name,
                        status: 'active',
                        organization,
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

            const school = await School.findOneOrFail({
                where: {
                    school_name: row.school_name,
                    status: 'active',
                    organization,
                },
            })

            const programDB = await connection.manager.findOneOrFail(Program, {
                where: {
                    name: row.program_name,
                    system: true,
                    organization: null,
                },
            })

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

                    const school = await School.findOneOrFail({
                        where: {
                            school_name: row.school_name,
                            status: 'active',
                            organization,
                        },
                    })

                    const programDB = await connection.manager.findOneOrFail(
                        Program,
                        {
                            where: {
                                name: row.program_name,
                                system: true,
                                organization: null,
                            },
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
