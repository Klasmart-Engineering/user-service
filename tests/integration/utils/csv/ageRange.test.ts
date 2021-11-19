import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { AgeRange } from '../../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../../src/entities/ageRangeUnit'
import { Organization } from '../../../../src/entities/organization'
import { Model } from '../../../../src/model'
import { AgeRangeRow } from '../../../../src/types/csv/ageRangeRow'
import { CSVError } from '../../../../src/types/csv/csvError'
import { createServer } from '../../../../src/utils/createServer'
import { processAgeRangeFromCSVRow } from '../../../../src/utils/csv/ageRange'
import { createAgeRange } from '../../../factories/ageRange.factory'
import { createOrganization } from '../../../factories/organization.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createTestConnection } from '../../../utils/testConnection'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { User } from '../../../../src/entities/user'
import { createAdminUser } from '../../../utils/testEntities'
import csvErrorConstants from '../../../../src/types/errors/csv/csvErrorConstants'

use(chaiAsPromised)

describe('processAgeRangeFromCSVRow', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let row: AgeRangeRow
    let organization: Organization
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions
    const rowModel: AgeRangeRow = {
        organization_name: 'Company 1',
        age_range_low_value: '6',
        age_range_high_value: '7',
        age_range_unit: 'year',
    }

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
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
    })

    context('when the organization name is not provided', () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it('returns rowErrors containing an ERR_CSV_MISSING_REQUIRED code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const orgRowError = rowErrors[0]
            expect(orgRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(orgRowError.message).to.equal(
                'On row number 1, organization name is required.'
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context('when the age range low value is not provided', () => {
        beforeEach(() => {
            row = { ...row, age_range_low_value: '' }
        })

        it('returns rowErrors containing an ERR_CSV_MISSING_REQUIRED code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(ageRowError.message).to.equal(
                'On row number 1, ageRange age_range_low_value is required.'
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context('when the age range high value is not provided', () => {
        beforeEach(() => {
            row = { ...row, age_range_high_value: '' }
        })

        it('returns rowErrors containing an ERR_CSV_MISSING_REQUIRED code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(3) // This is legacy behaviour and should be changed to only expect the below code+msg

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(ageRowError.message).to.equal(
                'On row number 1, ageRange age_range_high_value is required.'
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context('when the age range unit is not provided', () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: '' }
        })

        it('returns rowErrors containing an ERR_CSV_MISSING_REQUIRED code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(2) // This is legacy behaviour and should be changed to only expect the below code+msg

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(ageRowError.message).to.equal(
                'On row number 1, ageRange age_range_unit is required.'
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context('when the age range low value is not valid', () => {
        beforeEach(() => {
            row = { ...row, age_range_low_value: '100.5d' }
        })

        it('returns rowErrors containing an ERR_CSV_INVALID_BETWEEN code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_INVALID_BETWEEN')
            expect(ageRowError.message).to.equal(
                'On row number 1, ageRange age_range_low_value must be between 0 and 99.'
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context('when the age range high value is not valid', () => {
        beforeEach(() => {
            row = { ...row, age_range_high_value: '100.5d' }
        })

        it('returns rowErrors containing an ERR_CSV_INVALID_BETWEEN code and an appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_INVALID_BETWEEN')
            expect(ageRowError.message).to.equal(
                'On row number 1, ageRange age_range_high_value must be between 1 and 99.'
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context(
        'when the age range low value is greater than age range high value',
        () => {
            beforeEach(() => {
                row = {
                    ...row,
                    age_range_low_value: String(
                        Number(rowModel.age_range_high_value) + 1
                    ),
                }
            })

            it('returns rowErrors containing an ERR_CSV_INVALID_GREATER_THAN_OTHER code and appropriate message', async () => {
                const rowErrors = await processAgeRangeFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const ageRowError = rowErrors[0]
                expect(ageRowError.code).to.equal(
                    'ERR_CSV_INVALID_GREATER_THAN_OTHER'
                )
                expect(ageRowError.message).to.equal(
                    'On row number 1, ageRange age_range_high_value must be greater than age_range_low_value.'
                )

                const ageRange = await AgeRange.findOne({
                    where: {
                        name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                        low_value: Number(rowModel.age_range_low_value),
                        high_value: Number(rowModel.age_range_high_value),
                        low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                        high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                        status: 'active',
                        system: false,
                        organization,
                    },
                })

                expect(ageRange).to.be.undefined
            })
        }
    )

    context('when the age range unit is not valid', () => {
        beforeEach(() => {
            row = { ...row, age_range_unit: 'week' }
        })

        it('returns rowErrors containing an ERR_CSV_INVALID_ENUM code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_INVALID_ENUM')
            expect(ageRowError.message).to.equal(
                'On row number 1, ageRange age_range_unit must be one of these: month, year.'
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context("when the provided organization doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Company 2' }
        })

        it('returns rowErrors containing an ERR_CSV_NONE_EXIST_ENTITY code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_NONE_EXIST_ENTITY')
            expect(ageRowError.message).to.equal(
                `On row number 1, "${row.organization_name}" organization doesn't exist.`
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.be.undefined
        })
    })

    context('when the provided age range already exists', () => {
        beforeEach(async () => {
            const ageRange = await createAgeRange()
            ageRange.name = `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`
            ageRange.low_value = Number(rowModel.age_range_low_value)
            ageRange.high_value = Number(rowModel.age_range_high_value)
            ageRange.low_value_unit = rowModel.age_range_unit as AgeRangeUnit
            ageRange.high_value_unit = rowModel.age_range_unit as AgeRangeUnit
            ageRange.organization = Promise.resolve(organization)
            await connection.manager.save(ageRange)
        })

        it('returns rowErrors containing an ERR_CSV_DUPLICATE_CHILD_ENTITY code and appropriate message', async () => {
            const rowErrors = await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const ageRowError = rowErrors[0]
            expect(ageRowError.code).to.equal('ERR_CSV_DUPLICATE_CHILD_ENTITY')
            expect(ageRowError.message).to.equal(
                `On row number 1, "6 - 7 year(s)" ageRange already exists for "${rowModel.organization_name}" organization.`
            )

            const ageRange = await AgeRange.findOne({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            expect(ageRange).to.exist
        })
    })

    context('when all data provided is valid', () => {
        it('creates an age range with its relations', async () => {
            await processAgeRangeFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const ageRange = await AgeRange.findOneOrFail({
                where: {
                    name: `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`,
                    low_value: Number(rowModel.age_range_low_value),
                    high_value: Number(rowModel.age_range_high_value),
                    low_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    high_value_unit: rowModel.age_range_unit as AgeRangeUnit,
                    status: 'active',
                    system: false,
                    organization,
                },
            })

            const organizationInAgeRange = await ageRange.organization

            expect(ageRange).to.exist
            expect(ageRange.name).eq(
                `${rowModel.age_range_low_value} - ${rowModel.age_range_high_value} ${rowModel.age_range_unit}(s)`
            )
            expect(ageRange.system).eq(false)
            expect(ageRange.status).eq('active')
            expect(ageRange.low_value).eq(Number(rowModel.age_range_low_value))
            expect(ageRange.high_value).eq(
                Number(rowModel.age_range_high_value)
            )
            expect(ageRange.low_value_unit).eq(rowModel.age_range_unit)
            expect(ageRange.high_value_unit).eq(rowModel.age_range_unit)
            expect(organizationInAgeRange?.organization_id).eq(
                organization.organization_id
            )
        })
    })
})
