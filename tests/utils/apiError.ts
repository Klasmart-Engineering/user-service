import { expect } from 'chai'
import {
    APIError,
    APIErrorCollection,
    IAPIError,
} from '../../src/types/errors/apiError'
import { ErrorParams } from '../../src/types/errors/baseError'
import {
    GenericErrorCode,
    customErrors,
    genericErrorCodes,
} from '../../src/types/errors/customError'
import { Implements } from '../../src/types/generics'
import { stringInject } from '../../src/utils/stringUtils'

export function expectToBeAPIErrorCollection(
    error: Error,
    expectedErrors: IAPIError[]
) {
    expect(error).to.have.property('message').equal('ERR_API_BAD_INPUT')
    expect(error)
        .to.have.property('errors')
        .that.has.deep.members(expectedErrors)
}

function expectIsAPIErrorCollection(
    error: Error
): asserts error is APIErrorCollection {
    expect(error).to.have.property('message').equal('ERR_API_BAD_INPUT')
}

type ExpectAPIError<K extends keyof ErrorParams> = (
    actualError: Error,
    params: Required<Pick<ErrorParams, K>>,
    variables: APIError['variables']
) => Chai.Assertion

function expectAPIErrorType(
    expectedErrorType: GenericErrorCode,
    actualError: Error,
    params: ErrorParams,
    variables: APIError['variables']
) {
    expectIsAPIErrorCollection(actualError)
    const expectedError = customErrors[expectedErrorType] as {
        code: string
        message?: string
    }
    expect(actualError.errors?.[0]).to.deep.equal({
        code: expectedError.code,
        message: stringInject(expectedError?.message ?? '', params),
        variables,
        ...params,
    })
    return expect(actualError.errors).to.have.length(1)
}

type ExpectAPIErrors = Implements<
    {
        [key in GenericErrorCode]: ExpectAPIError<keyof ErrorParams>
    },
    {
        duplicate_entity: ExpectAPIError<'entity' | 'entityName'>
        duplicate_child_entity: ExpectAPIError<
            'entity' | 'entityName' | 'parentEntity' | 'parentName'
        >
        duplicate_attribute_values: ExpectAPIError<'entity' | 'attribute'>
        nonexistent_entity: ExpectAPIError<'entity' | 'entityName'>
        nonexistent_child: ExpectAPIError<
            'entity' | 'entityName' | 'parentEntity' | 'parentName'
        >
        missing_required_entity_attribute: ExpectAPIError<
            'entity' | 'attribute'
        >
        missing_required_either: ExpectAPIError<
            'entity' | 'attribute' | 'otherAttribute'
        >
        invalid_max_length: ExpectAPIError<'entity' | 'attribute' | 'max'>
        invalid_min_length: ExpectAPIError<'entity' | 'attribute' | 'min'>
        invalid_alphanumeric_special: ExpectAPIError<'entity' | 'attribute'>
        invalid_alpha: ExpectAPIError<'entity' | 'attribute'>
        invalid_alphanumeric: ExpectAPIError<'entity' | 'attribute'>
        invalid_email: ExpectAPIError<'entity' | 'attribute'>
        invalid_phone: ExpectAPIError<'entity' | 'attribute'>
        invalid_date: ExpectAPIError<'entity' | 'attribute'>
        invalid_uuid: ExpectAPIError<'entity' | 'attribute'>
        unauthorized: ExpectAPIError<'entity' | 'attribute'>
        invalid_format: ExpectAPIError<'entity' | 'attribute'>
        invalid_operation_type: ExpectAPIError<'attribute' | 'otherAttribute'>
        inactive_status: ExpectAPIError<'entity' | 'entityName'>
        delete_rejected_entity_in_use: ExpectAPIError<'entity' | 'entityName'>
    }
>

export const expectAPIError = Object.fromEntries(
    Object.keys(customErrors)
        .filter((error) =>
            genericErrorCodes.includes(error as GenericErrorCode)
        )
        .map((error) => error as GenericErrorCode)
        .map((error) => [
            error,
            (actualError: Error, params: ErrorParams, variables: string[]) =>
                expectAPIErrorType(error, actualError, params, variables),
        ])
) as ExpectAPIErrors
