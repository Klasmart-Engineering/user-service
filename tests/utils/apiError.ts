import { expect } from 'chai'
import { IAPIError } from '../../src/types/errors/apiError'

export function expectToBeAPIErrorCollection(
    error: Error,
    expectedErrors: IAPIError[]
) {
    expect(error).to.have.property('message').equal('ERR_API_BAD_INPUT')
    expect(error)
        .to.have.property('errors')
        .that.has.deep.members(expectedErrors)
}
