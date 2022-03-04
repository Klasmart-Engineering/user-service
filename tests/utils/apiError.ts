import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import {
    APIError,
    APIErrorCollection,
    formatMessage,
    IAPIError,
} from '../../src/types/errors/apiError'
import { ErrorParams } from '../../src/types/errors/baseError'
import {
    GenericErrorCode,
    customErrors,
    genericErrorCodes,
} from '../../src/types/errors/customError'
import { Implements } from '../../src/types/generics'

use(deepEqualInAnyOrder)

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

function expectAPIErrorType(
    expectedErrorType: GenericErrorCode,
    actualError: Error,
    params: ErrorParams,
    variables: APIError['variables'],
    errorIndex = 0,
    errorCount = 1
) {
    expectIsAPIErrorCollection(actualError)
    const expectedError = {
        ...customErrors[expectedErrorType],
        variables,
        ...params,
    } as APIError
    compareErrors(actualError.errors[errorIndex], {
        code: expectedError.code,
        message: formatMessage(expectedError.message, params),
        variables,
        ...params,
    } as APIError)
    return expect(actualError.errors).to.have.length(errorCount)
}

type ExpectAPIError<K extends keyof ErrorParams> = (
    actualError: Error,
    params:
        | Required<Pick<ErrorParams, K>>
        | Required<Pick<ErrorParams, K | 'index'>>,
    variables: APIError['variables'],
    errorIndex?: number,
    errorCount?: number
) => Chai.Assertion

type ExpectAPIErrors = Implements<
    {
        [key in GenericErrorCode]: ExpectAPIError<keyof ErrorParams>
    },
    {
        existent_entity: ExpectAPIError<'entity' | 'entityName'>
        existent_child_entity: ExpectAPIError<
            'entity' | 'entityId' | 'parentEntity' | 'parentId'
        >
        duplicate_attribute_values: ExpectAPIError<'entity' | 'attribute'>
        nonexistent_entity: ExpectAPIError<'entity' | 'entityName'>
        nonexistent_child: ExpectAPIError<
            'entity' | 'entityId' | 'parentEntity' | 'parentId'
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
        nonexistent_or_inactive: ExpectAPIError<
            'entity' | 'attribute' | 'otherAttribute'
        >
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
            (
                actualError: Error,
                params: ErrorParams,
                variables: string[],
                errorIndex?: number,
                errorCount?: number
            ) =>
                expectAPIErrorType(
                    error,
                    actualError,
                    params,
                    variables,
                    errorIndex,
                    errorCount
                ),
        ])
) as ExpectAPIErrors

export function compareErrors(error: APIError, expectedError: APIError) {
    expect(error.code).to.eq(expectedError.code)
    expect(error.message).to.eq(expectedError.message)
    expect(error.variables).to.deep.equalInAnyOrder(expectedError.variables)
    expect(error.entity).to.eq(expectedError.entity)
    expect(error.entityName).to.eq(expectedError.entityName)
    expect(error.attribute).to.eq(expectedError.attribute)
    expect(error.attributeValue).to.eq(expectedError.attributeValue)
    expect(error.otherAttribute).to.eq(expectedError.otherAttribute)
    expect(error.index).to.eq(expectedError.index)
    expect(error.min).to.eq(expectedError.min)
    expect(error.max).to.eq(expectedError.max)
}

export function compareMultipleErrors(
    errors: APIError[],
    expectedErrors: APIError[]
) {
    expect(errors.length).to.equal(expectedErrors.length)
    for (let i = 0; i < errors.length; i++) {
        compareErrors(errors[i], expectedErrors[i])
    }
}

export async function expectAPIErrorCollection(
    resolverCall: Promise<any>,
    expectedErrors: APIErrorCollection
) {
    const { errors } = (await expect(resolverCall).to.be
        .rejected) as APIErrorCollection

    expect(errors).to.exist

    for (let x = 0; x < errors.length; x++)
        compareErrors(errors[x], expectedErrors.errors[x])
}

export function checkNotFoundErrors(
    actualError: Error,
    expectedErrors: {
        entity: string
        id: string
        entryIndex: number
    }[]
) {
    expectedErrors.forEach((val, errorIndex) => {
        expectAPIError.nonexistent_entity(
            actualError,
            {
                entity: val.entity,
                entityName: val.id,
                index: val.entryIndex,
            },
            ['id'],
            errorIndex,
            expectedErrors.length
        )
    })
}
