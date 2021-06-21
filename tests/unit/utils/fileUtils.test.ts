import { expect } from 'chai'
import { FileUpload } from 'graphql-upload'

import { extensionForFile } from '../../../src/utils/fileUtils'

describe('extensionForFile', () => {
    let file: FileUpload

    context('when the mimetype is valid', () => {
        beforeEach(() => {
            file = {
                filename: 'icon',
                mimetype: 'image/jpeg',
                encoding: 'jpeg',
            } as FileUpload
        })

        it('returns the correct file extension', () => {
            expect(extensionForFile(file)).to.eq('jpeg')
        })
    })

    context('when the mimetype is invalid', () => {
        beforeEach(() => {
            file = {
                filename: 'icon',
                mimetype: '',
                encoding: 'ascii',
            } as FileUpload
        })

        it('returns undefined', () => {
            expect(extensionForFile(file)).to.be.undefined
        })
    })
})
