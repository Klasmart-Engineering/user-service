import { getCustomErrorMessageVariables } from '../../../src/types/errors/customError'
import { expect } from 'chai'

describe('getErrorVariables()', () => {
    it('returns an empty array when there are no matches', () => {
        expect(getCustomErrorMessageVariables('').length).to.eq(0)
    })
    it('returns variable names enclosed in curly braces', () => {
        const vars = getCustomErrorMessageVariables(
            'File size ({fileSize}) exceeds max file size ({maxSize})'
        )
        expect(vars).to.include('fileSize')
        expect(vars).to.include('maxSize')
    })
})
