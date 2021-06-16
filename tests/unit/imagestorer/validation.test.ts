import { expect } from 'chai'
import { isHexColor, testMimeType } from '../../../src/services/imagestorer'

describe('isHexColor', () => {
    it('is a valid hexColor', async () => {
        ;[
            'ff22aa',
            'FF22AA',
            '000000',
            '999999',
            'abcdef',
            '012345',
            'ABCDEF',
            '1A2C3D',
            '1a2b3c',
            'ffffff',
        ].every(function (color) {
            const res = isHexColor(color)
            expect(res).to.equal(true)
            return res
        })
    })
    it('is not a valid hexColor', async () => {
        ;[
            'ff22aadd',
            'FF22HH',
            '0000OO',
            '9999999',
            'abc',
            '0123456',
            'BCDEFG',
            'lA2C3D',
            '1a2P3c',
            '0xffffff',
        ].every(function (color) {
            const res = isHexColor(color)
            expect(res).to.equal(false)
            return res
        })
    })
})

describe('testMimeType', () => {
    it('is a supported mimetype', async () => {
        ;['image/jpeg', 'image/png'].every(function (mimetype) {
            const res = testMimeType(mimetype)
            expect(res).to.equal(true)
            return res
        })
    })
    it('is not a supported mimetype', async () => {
        ;[
            'application/pdf',
            'video/x-msvideo',
            'application/octet-stream',
            'image/bmp',
        ].every(function (mimetype) {
            const res = testMimeType(mimetype)
            expect(res).to.equal(false)
            return res
        })
    })
})
