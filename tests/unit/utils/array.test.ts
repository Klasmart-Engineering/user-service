import { expect } from 'chai'
import { isSubsetOf } from '../../../src/utils/array'

describe('isSubsetOf', () => {
    it('if the subset array is larger, returns false', () => {
        expect(isSubsetOf([1, 2], [1])).to.be.false
    })
    it("if the subset array isn't contained in the superset, returns false", () => {
        expect(isSubsetOf([1, 3], [1, 2])).to.be.false
    })
    it('if the arrays are the same returns true', () => {
        expect(isSubsetOf([1, 2], [1, 2])).to.be.true
    })
    it('if the subset array is contained in the superset, returns true', () => {
        expect(isSubsetOf([1, 2], [1, 2, 3])).to.be.true
    })
})
