import { Connection } from 'typeorm'
import { expect } from 'chai'
import fs from 'fs'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { createServer } from '../../../src/utils/createServer'
import { createTestConnection } from '../../utils/testConnection'
import { getAdminAuthToken } from '../../utils/testConfig'
import { uploadFile } from '../../utils/operations/modelOps'
import { Model } from '../../../src/model'
import { resolve } from 'path'

describe('isMIMEType', async () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    context('when the mimetype is not the expected', async () => {
        it('should return null', async () => {
            const filename = 'example.txt'
            const file = fs.createReadStream(
                resolve(`tests/fixtures/${filename}`)
            )
            const mimetype = 'text/plain'
            const encoding = '7bit'
            const result = await uploadFile(
                testClient,
                { file, filename, mimetype, encoding },
                { authorization: getAdminAuthToken() }
            )

            expect(result).null
        })
    })

    context('when the mimetype is the expected', async () => {
        it('should return File', async () => {
            const filename = 'organizationsExample.csv'
            const file = fs.createReadStream(
                resolve(`tests/fixtures/${filename}`)
            )
            const mimetype = 'text/csv'
            const encoding = '7bit'
            const result = await uploadFile(
                testClient,
                { file, filename, mimetype, encoding },
                { authorization: getAdminAuthToken() }
            )

            expect(result.filename).eq(filename)
            expect(result.mimetype).eq(mimetype)
            expect(result.encoding).eq(encoding)
        })
    })
})
