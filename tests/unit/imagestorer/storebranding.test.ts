import { expect } from 'chai'
import { resolve } from 'path'
import { ImageStorer } from '../../../src/services/imagestorer'
import tmp, { FileResult, fileSync } from 'tmp'
import * as fs from 'fs'
import { identifyImage } from '../../utils/operations/brandingOps'

describe('scaleImage', () => {
    let tmpFileObj: FileResult
    beforeEach(async () => {
        tmpFileObj = tmp.fileSync({ postfix: '.ico' })
    })
    afterEach(async () => {
        if (tmpFileObj) {
            fs.unlink(tmpFileObj.name, (err) => {
                if (err) {
                    console.log(err)
                }
            })
        }
    })
    it('scales an image', async () => {
        const ims = new ImageStorer()
        await ims['scaleImageFile'](
            resolve(`tests/fixtures/icon.png`),
            tmpFileObj.name,
            '16x16'
        )
        const guff = await identifyImage(['-verbose', tmpFileObj.name])
        expect(guff).contains('Geometry: 16x16+0+0')
        expect(guff).contains('Format: ICO (Microsoft icon)')
    })
})
