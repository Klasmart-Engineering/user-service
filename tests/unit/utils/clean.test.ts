import { expect } from 'chai'
import clean from '../../../src/utils/clean'

describe('email', () => {
    it('normalises "" to null', () => {
        expect(clean.email('')).to.be.null
    })

    it('if invalid is replaced with undefined', () => {
        expect(clean.email('not-an-email')).to.be.undefined
    })

    it('preserves null', () => {
        expect(clean.email(null)).to.be.null
    })

    it('removes spaces', () => {
        expect(clean.email(' abc@def.com ')).to.equal('abc@def.com')
    })

    it('forces lowercase', () => {
        expect(clean.email('AbC@dEf.com')).to.equal('abc@def.com')
    })
})

describe('phone', () => {
    it('normalises "" to null', () => {
        expect(clean.phone('')).to.be.null
    })

    it('if invalid is replaced with undefined', () => {
        expect(clean.phone('not-a-phone-number')).to.be.undefined
    })

    it('preserves null', () => {
        expect(clean.phone(null)).to.be.null
    })

    it('removes spaces', () => {
        expect(clean.phone(' +4412345678910 ')).to.equal('+4412345678910')
    })
})
