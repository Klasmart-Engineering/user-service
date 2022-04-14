import { expect } from 'chai'
import { REGEX } from '../../../src/entities/validations/regex'

describe('regex', () => {
    describe('alphanum_with_special_characters', () => {
        const regex = REGEX.alphanum_with_special_characters

        it('accepts letters and numbers', () => {
            expect(regex.test('abc123éĐЏ漢აЛف')).to.be.true
        })
        it('accepts some special characters', () => {
            const special = [' ', '.', "'", '&', '/', ',', '-']
            for (const s of special) {
                expect(regex.test(s)).to.be.true
            }
        })
        it('rejects other special characters', () => {
            const special = ['!', '*', '@', '#', '$', '%', '^', '?']
            for (const s of special) {
                expect(regex.test(s)).to.be.false
            }
        })
        // Thai strings require \p{M} in regex
        it('accepts Thai strings', () => {
            expect(regex.test('โรงเรียนมีสุข')).to.be.true
        })
    })
})
