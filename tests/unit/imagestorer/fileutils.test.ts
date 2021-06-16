import { expect } from 'chai'
import { extensionFromMimeType } from '../../../src/services/imagestorer'

describe('extensionFromMimeType', () => {
    it('it returns jpeg tail correctly', async () => {
        expect(extensionFromMimeType('image/jpeg')).to.equal('jpeg')
    })
    it('it returns png tail correctly', async () => {
        expect(extensionFromMimeType('image/png')).to.equal('png')
    })
})
