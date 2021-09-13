import { expect } from 'chai'
import clean from '../../../src/utils/clean'

describe('email', () => {
    it('normalises "" to null', () => {
        expect(clean.email('')).to.be.null
    })

    it('if invalid is unchanged', () => {
        const input = 'not-an-email'
        expect(clean.email(input)).to.equal(input)
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

    it('if invalid is unchanged', () => {
        const input = 'not-a-phone-number'
        expect(clean.phone(input)).to.equal(input)
    })

    it('preserves null', () => {
        expect(clean.phone(null)).to.be.null
    })

    it('removes spaces', () => {
        expect(clean.phone(' +4412345678910 ')).to.equal('+4412345678910')
    })
})
