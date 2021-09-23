import { expect, use } from 'chai'
import faker from 'faker'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import Joi from 'joi'

use(deepEqualInAnyOrder)

type ExpectedValidationError = {
    label: string
    type: string
}

export function expectValidationErrors(
    error: Joi.ValidationError | undefined,
    expectedValidationErrors: ExpectedValidationError[]
) {
    expect(
        error?.details.map((detail) => {
            return {
                label: detail.context?.label,
                type: detail.type,
            }
        })
    ).to.deep.equalInAnyOrder(expectedValidationErrors)
}

function arrayContainingOnly(
    schema: Joi.ArraySchema,
    value: unknown,
    type: string
) {
    it(`passes validation if an array with a valid ${type}`, () => {
        const { error } = schema.validate([value])

        expect(error).to.be.undefined
    })

    it(`fails validation if an array with an invalid ${type}`, () => {
        const { error } = schema.validate(['not-a-uuid', value])

        expect(error?.details).to.have.length(1)
        expect(error?.details[0].type).to.equal('string.guid')
    })
}

function uniqueArray(schema: Joi.ArraySchema, value: unknown, type: string) {
    it(`fails validation if the array contains duplicate ${type}s`, () => {
        const { error } = schema.validate([value, value])

        expect(error?.details).to.have.length(1)
        expect(error?.details[0].type).to.equal('array.unique')
    })
}

export function arraySchemaContext(schema: Joi.ArraySchema) {
    it('fails validation if not an array', () => {
        const { error } = schema.validate('not-an-array')

        expect(error?.details).to.have.length(1)
        expect(error?.details[0].type).to.equal('array.base')
    })

    return {
        optional() {
            it('passes validation if an empty array', () => {
                const { error } = schema.validate([])

                expect(error).to.be.undefined
            })

            it('passes validation if undefined', () => {
                const { error } = schema.validate(undefined)

                expect(error).to.be.undefined
            })
        },
        required() {
            it('fails validation if an empty array', () => {
                const { error } = schema.validate([])

                expect(error?.details).to.have.length(1)
                expect(error?.details[0].type).to.equal(
                    'array.includesRequiredUnknowns'
                )
            })

            it('fails validation if undefined', () => {
                const { error } = schema.validate(undefined)

                expect(error?.details).to.have.length(1)
                expect(error?.details[0].type).to.equal('any.required')
            })
        },
        unique: {
            string() {
                arrayContainingOnly(schema, faker.random.word(), 'string')
            },
            uuid() {
                uniqueArray(schema, faker.datatype.uuid(), 'UUID')
            },
        },
        only: {
            string() {
                arrayContainingOnly(schema, faker.random.word(), 'string')
            },
            uuid() {
                arrayContainingOnly(schema, faker.datatype.uuid(), 'UUID')
            },
        },
    }
}
