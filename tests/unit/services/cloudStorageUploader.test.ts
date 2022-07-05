import { expect, use } from 'chai'
import { CloudStorageUploader } from '../../../src/services/cloudStorageUploader'
import { ReadStream } from 'fs'
import { restore, stub } from 'sinon'
import * as storageUtil from '../../../src/utils/storage'
import { PassThrough, Readable, Stream } from 'stream'
import { storage } from 'pkgcloud'
import chaiAsPromised from 'chai-as-promised'

use(chaiAsPromised)

describe('cloudStorageUploader', () => {
    let mockWriteStream: PassThrough
    let mockReadStream: Readable
    const expectedError = 'something is broken'
    const expectedValue = 'theExpectedValue'

    beforeEach(() => {
        mockWriteStream = new PassThrough()
        stub(storageUtil, 'createCloudClient').returns(({
            upload: () => (mockWriteStream as unknown) as NodeJS.WriteStream,
        } as unknown) as storage.Client)

        mockReadStream = new Stream.Readable()
        mockReadStream.push(JSON.stringify({ location: expectedValue }))
        mockReadStream.push(null)
    })

    afterEach(() => {
        restore()
    })

    context('when the write stream emits an error', () => {
        beforeEach(() => {
            mockWriteStream.on('data', () =>
                mockWriteStream.emit('error', expectedError)
            )
        })

        it('handles the error gracefully', async () => {
            await expect(
                CloudStorageUploader.call(mockReadStream as ReadStream, '')
            ).to.be.rejectedWith(`failed to upload file: ${expectedError}`)
        })
    })

    context('when the write stream emits success', () => {
        beforeEach(() => {
            mockWriteStream.on('data', (data) => {
                mockWriteStream.emit('success', JSON.parse(data.toString()))
            })
        })

        it('returns the expected value', async () => {
            const returnedValue = await CloudStorageUploader.call(
                mockReadStream as ReadStream,
                ''
            )
            expect(returnedValue).to.equal(expectedValue)
        })
    })
})
