import { expect } from 'chai'
import { parseRange } from '../../../src/services/accountDeletionSheet'

describe('parseRange()', () => {
    it('successfully parses a valid long table range', () => {
        const rangeString = 'Sheet21412!AC412:POA0123'
        const parsedRange = parseRange(rangeString)
        expect(parsedRange.startRow).to.equal(412)
        expect(parsedRange.endRow).to.equal(123)
        expect(parsedRange.startColumn).to.equal('AC')
        expect(parsedRange.endColumn).to.equal('POA')
    })

    it('throws an error when parsing ranges in an invalid format', () => {
        expect(() => parseRange('AC412:POA0123')).to.throw(
            'Failed to parse table range'
        )
        expect(() => parseRange('Sheet21412!412AC:123POA')).to.throw(
            'Failed to parse table range'
        )
    })
})
