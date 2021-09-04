import { expect } from 'chai'
import Joi from 'joi'
import { APISchema, APISchemaMetadata } from '../../../src/types/api'
import {
    APIError,
    joiResultToAPIErrors,
} from '../../../src/types/errors/apiError'
import { customErrors } from '../../../src/types/errors/customError'
import { stringInject } from '../../../src/utils/stringUtils'

context('joiResultToAPIErrors', () => {
    const MAX_CONSTRAINT = 5
    const ENTITY = 'Animal'
    const ATTRIBUTE = 'nickname'
    type FakeAPI = {
        name: string
    }

    const fakeAPISchema: APISchema<FakeAPI> = {
        name: Joi.string().max(MAX_CONSTRAINT),
    }

    const fakeAPISchemaMetadata: APISchemaMetadata<FakeAPI> = {
        name: {
            entity: ENTITY,
            attribute: ATTRIBUTE,
            max: MAX_CONSTRAINT,
        },
    }

    const expectedError = customErrors.invalid_max_length

    let apiError: APIError

    before(() => {
        apiError = joiResultToAPIErrors<FakeAPI>(
            Joi.object(fakeAPISchema).validate({ name: 'too-long' }),
            fakeAPISchemaMetadata
        )[0]
    })

    it('sets "entity" from the schema metadata', () => {
        expect(apiError?.entity).to.equal(ENTITY)
    })

    it('sets "attribute" from the schema metadata', () => {
        expect(apiError?.attribute).to.equal(ATTRIBUTE)
    })

    it('sets "code" based on the custom constraint details', () => {
        expect(apiError.code).to.equal(expectedError.code)
    })

    it('sets "message" injecting the custom constraint details and schema metadata', () => {
        expect(apiError.message).to.equal(
            stringInject(expectedError.message, {
                entity: ENTITY,
                attribute: ATTRIBUTE,
                max: MAX_CONSTRAINT,
            })
        )
    })

    it('sets additional custom constraint detail parameters', () => {
        expect(apiError?.max).to.equal(MAX_CONSTRAINT)
    })
})
