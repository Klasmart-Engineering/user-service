import { expect, use } from 'chai'
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
