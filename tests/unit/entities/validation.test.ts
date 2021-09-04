import { expect } from 'chai'
import Joi, { ValidationErrorItem } from 'joi'
import { getCustomConstraintDetails } from '../../../src/entities/validations/messages'
import { customErrors } from '../../../src/types/errors/customError'

context('getCustomConstraintDetails', () => {
    function validationResultShouldMapToCustomError(
        result: Joi.ValidationResult,
        error: typeof customErrors[keyof typeof customErrors]
    ) {
        const validationError = result.error?.details[0]

        it(`${validationError?.type} Joi error maps to this code`, () => {
            expect(validationError).not.to.be.undefined
            expect(
                getCustomConstraintDetails(
                    validationError as ValidationErrorItem
                )
            ).to.deep.equal(error)
        })
    }

    context('ERR_MISSING_REQUIRED_ENTITY_ATTRIBUTE', () => {
        ;[
            Joi.string().validate(''),
            Joi.string().required().validate(undefined),
            Joi.array().items(Joi.string().required()).validate([]),
        ].forEach((result) => {
            validationResultShouldMapToCustomError(
                result,
                customErrors.missing_required_entity_attribute
            )
        })
    })

    context('ERR_INVALID_UUID', () => {
        ;[Joi.string().uuid().validate('not-a-uuid')].forEach((result) => {
            validationResultShouldMapToCustomError(
                result,
                customErrors.invalid_uuid
            )
        })
    })

    context('ERR_DUPLICATE_ATTRIBUTE_VALUES', () => {
        ;[Joi.array().items().unique().validate([1, 1])].forEach((result) => {
            validationResultShouldMapToCustomError(
                result,
                customErrors.duplicate_attribute_values
            )
        })
    })
})
