import { expect } from 'chai'
import { isSubsetOf, sortObjectArray } from '../../../src/utils/array'

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

describe('sortObjectArray', () => {
    type ObjectType = { id: number; name: string }
    const objectArray: ObjectType[] = [
        { id: 56, name: 'Frodo' },
        { id: 5, name: 'Merry' },
        { id: 87, name: 'Sam' },
        { id: 7, name: 'Pippin' },
    ]
    const objectArrayNumSorted: ObjectType[] = [
        { id: 5, name: 'Merry' },
        { id: 7, name: 'Pippin' },
        { id: 56, name: 'Frodo' },
        { id: 87, name: 'Sam' },
    ]
    const objectArrayAlphaSorted: ObjectType[] = [
        { id: 56, name: 'Frodo' },
        { id: 5, name: 'Merry' },
        { id: 7, name: 'Pippin' },
        { id: 87, name: 'Sam' },
    ]

    it('sorts a numerical field in ascending order', () => {
        sortObjectArray(objectArray, 'id')
        expect(objectArray).to.deep.equal(objectArrayNumSorted)
    })

    it('sorts a numerical field in descending order', () => {
        sortObjectArray(objectArray, 'id', false)
        expect(objectArray).to.deep.equal(objectArrayNumSorted.reverse())
    })

    it('sorts an alphabetical field in ascending order', () => {
        sortObjectArray(objectArray, 'name')
        expect(objectArray).to.deep.equal(objectArrayAlphaSorted)
    })

    it('sorts an alphabetical field in descending order', () => {
        sortObjectArray(objectArray, 'name', false)
        expect(objectArray).to.deep.equal(objectArrayAlphaSorted.reverse())
    })
})
