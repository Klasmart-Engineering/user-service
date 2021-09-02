import { expect } from 'chai'
import { buildCsvError, validateRow } from '../../../src/utils/csv/csvUtils'
import Joi from 'joi'
import { customErrors } from '../../../src/types/errors/customError'
import { HeaderValidation } from '../../../src/types/csv/createEntityHeadersCallback'

describe('validateRow()', () => {
    const schema = {
        a: {
            entity: 'example',
            attribute: 'a',
            validation: Joi.string().required().max(3).alphanum(),
        },
    }

    it('checks for missing properties', () => {
        const row = {}
        const errors = validateRow(row, 0, schema)
        expect(errors.length).to.eq(1)
    })

    it('checks all validations/does not abort early', () => {
        const row = { a: '(())' }
        const errors = validateRow(row, 0, schema)
        expect(errors.length).to.eq(2)
    })

    it('allows unknown properties', () => {
        const row = { a: 'foo', b: 'bar' }
        const errors = validateRow(row, 0, schema as any)
        expect(errors.length).to.eq(0)
    })

    it('returns correctly formatted CSVErrors', () => {
        const row = { a: 'abcdef' }
        const errors = validateRow(row, 0, schema)
        expect(errors.length).to.eq(1)
        expect(errors[0].code).to.eq(customErrors.invalid_max_length.code)
        expect(errors[0].row).to.eq(0)
        expect(errors[0].column).to.eq('a')
        expect(errors[0].entity).to.eq(schema.a.entity)
        expect(errors[0].attribute).to.eq(schema.a.attribute)
    })

    it('returns an empty array when there are no validation errors', () => {
        const row = { a: 'foo' }
        const errors = validateRow(row, 0, schema)
        expect(errors.length).to.eq(0)
    })
})

describe('validateHeader()', () => {
    const UserRowUniqueColumns = new Set<string>([
        'First',
        'Second',
        'Third',
        'Fourth',
        'Fifth',
    ])

    const UserRowRequiredColumns = new Set<string>(['First', 'Third', 'Fourth'])

    const UserRowEitherRequiredColumns = [new Set<string>(['Second', 'Fifth'])]

    const UserRowRequirements = new HeaderValidation(
        UserRowUniqueColumns,
        UserRowRequiredColumns,
        UserRowEitherRequiredColumns
    )

    it('checks for missing header', () => {
        const filename = 'example_filename.csv'
        const header = ['First', 'Third', 'Fifth']

        const expectedCSVError = buildCsvError(
            customErrors.csv_missing_required_column.code,
            0,
            'Fourth',
            customErrors.csv_missing_required_column.message,
            {
                fileName: filename,
                columnName: 'Fourth',
            }
        )

        try {
            const errs = UserRowRequirements.validate(header, filename)
            if (errs.length) {
                throw errs
            }
            expect.fail(`Function incorrectly returned no errors.`)
        } catch (e) {
            expect(e).to.have.length(1)
            expect(e).to.have.deep.members([expectedCSVError])
        }
    })

    it('checks for duplicated header', () => {
        const filename = 'example_filename.csv'
        const header = ['First', 'Third', 'Third', 'Fourth', 'Fifth']

        const expectedCSVError = buildCsvError(
            customErrors.csv_duplicate_column.code,
            0,
            'Third',
            customErrors.csv_duplicate_column.message,
            {
                fileName: filename,
                columnName: 'Third',
            }
        )

        try {
            const errs = UserRowRequirements.validate(header, filename)
            if (errs.length) {
                throw errs
            }
            expect.fail(`Function incorrectly returned no errors.`)
        } catch (e) {
            expect(e).to.have.length(1)
            expect(e).to.have.deep.members([expectedCSVError])
        }
    })

    it('checks for either required header - neither', () => {
        const filename = 'example_filename.csv'
        const header = ['First', 'Third', 'Fourth']

        const expectedCSVError = buildCsvError(
            customErrors.csv_missing_required_column.code,
            0,
            'Second or Fifth',
            customErrors.csv_missing_required_column.message,
            {
                fileName: filename,
                columnName: 'either Second or Fifth',
            }
        )

        try {
            const errs = UserRowRequirements.validate(header, filename)
            if (errs.length) {
                throw errs
            }
            expect.fail(`Function incorrectly returned no errors.`)
        } catch (e) {
            expect(e).to.have.length(1)
            expect(e).to.have.deep.members([expectedCSVError])
        }
    })

    it('checks for either required header - one', () => {
        const filename = 'example_filename.csv'
        const header = ['First', 'Second', 'Third', 'Fourth']

        const errs = UserRowRequirements.validate(header, filename)
        expect(errs.length).to.equal(0)
    })

    it('checks for either required header - The other', () => {
        const filename = 'example_filename.csv'
        const header = ['First', 'Third', 'Fourth', 'Fifth']

        const errs = UserRowRequirements.validate(header, filename)
        expect(errs.length).to.equal(0)
    })

    it('checks for either required header - both', () => {
        const filename = 'example_filename.csv'
        const header = ['First', 'Second', 'Third', 'Fourth', 'Fifth']

        const errs = UserRowRequirements.validate(header, filename)
        expect(errs.length).to.equal(0)
    })
})
