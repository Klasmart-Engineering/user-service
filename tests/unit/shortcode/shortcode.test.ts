import { expect } from 'chai'
import {
    generateShortCode,
    SHORTCODE_DEFAULT_MAXLEN,
    validateShortCode,
} from '../../../src/utils/shortcode'
import { config } from '../../../src/config/config'

describe('shortcode', () => {
    const shortcode_re = /^[A-Z|0-9]+$/
    context('we have a string', () => {
        const stringValue = 'This is a string value'

        it('We generate a shortcode ', async () => {
            const shortcode = generateShortCode(stringValue)
            expect(shortcode).to.match(shortcode_re)
            expect(shortcode.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
        })
    })
    context('we do not have a string', () => {
        it('We generate a shortcode ', async () => {
            const shortcode = generateShortCode()
            expect(shortcode).to.match(shortcode_re)
            expect(shortcode.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
        })
    })
    context('we have a long string', () => {
        const stringValue = 'This is a long string value'
        it('We generate two shortcodes and they are the same', async () => {
            const shortcode = generateShortCode(stringValue)
            expect(shortcode).to.match(shortcode_re)
            expect(shortcode.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
            const shortcode2 = generateShortCode(stringValue)
            expect(shortcode2).to.match(shortcode_re)
            expect(shortcode2.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
            expect(shortcode2).to.equal(shortcode)
        })
    })
    context('we have a small string', () => {
        const stringValue = 'T'
        it('We generate two shortcodes and they are the same', async () => {
            const shortcode = generateShortCode(stringValue)
            expect(shortcode).to.match(shortcode_re)
            expect(shortcode.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
            const shortcode2 = generateShortCode(stringValue)
            expect(shortcode2).to.match(shortcode_re)
            expect(shortcode2.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
            expect(shortcode2).to.equal(shortcode)
        })
    })
    context('we have a no string', () => {
        it('We generate two shortcodes and they are the different', async () => {
            const shortcode = generateShortCode()
            expect(shortcode).to.match(shortcode_re)
            expect(shortcode.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
            const shortcode2 = generateShortCode()
            expect(shortcode2).to.match(shortcode_re)
            expect(shortcode2.length).to.equal(SHORTCODE_DEFAULT_MAXLEN)
            expect(shortcode2).to.not.equal(shortcode)
        })
    })
})

describe('valid ShortCode', () => {
    it('is a valid shortcode', async () => {
        ;['1929990995', 'ABCDEF345U', '1234567890', 'P5X'].every(function (
            code
        ) {
            const res = validateShortCode(code)
            expect(res).is.equal(true)
            return res
        })
    })
    it('is an invalid shortcode', async () => {
        ;[
            '1929 90995',
            'abcdeF345U',
            'The thing about',
            'P5/DS56YU=',
            '1234567890A',
        ].every(function (code) {
            const res = !validateShortCode(code)
            expect(res).is.equal(true)
            return res
        })
    })
})
describe('valid long ShortCode', () => {
    it('is a valid shortcode', async () => {
        ;[
            '1929990999999995',
            'ABCDEF345UAQERT5',
            '1234567890123456',
            'P5X',
        ].every(function (code) {
            const res = validateShortCode(
                code,
                config.limits.SHORTCODE_MAX_LENGTH
            )
            expect(res).is.equal(true)
            return res
        })
    })
    it('is an invalid long shortcode', async () => {
        ;[
            '1929 90995667 88',
            'abcdeF345UfrffC',
            'The thing about it is',
            'P5/DS56YU=',
            '1234567890123456A',
        ].every(function (code) {
            const res = !validateShortCode(
                code,
                config.limits.SHORTCODE_MAX_LENGTH
            )
            expect(res).is.equal(true)
            return res
        })
    })
})
