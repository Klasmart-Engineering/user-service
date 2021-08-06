import { expect } from 'chai'
import { validateRow } from '../../../src/utils/csv/csvUtils'
import Joi from 'joi'
import { customErrors } from '../../../src/types/errors/customError'

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
