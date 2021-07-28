import { expect, use } from 'chai'
import { Connection, EntityManager } from 'typeorm'
import { Subject } from '../../../../src/entities/subject'
import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { uploadSubjects } from '../../../utils/operations/csv/uploadSubjects'
import { createTestConnection } from '../../../utils/testConnection'
import { resolve } from 'path'
import { ReadStream } from 'fs'
import fs from 'fs'
import chaiAsPromised from 'chai-as-promised'
import { processSubjectFromCSVRow } from '../../../../src/utils/csv/subject'
import { readCSVFile } from '../../../../src/utils/csv/readFile'
import { Upload } from '../../../../src/types/upload'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { CreateEntityRowCallback } from '../../../../src/types/csv/createEntityRowCallback'

use(chaiAsPromised)

describe('read file', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let adminPermissions: UserPermissions

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
        const adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    after(async () => {
        await connection?.close()
    })

    context('when file data is empty', () => {
        const filename = 'empty.csv'
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const dummyFn: CreateEntityRowCallback = async (
            manager: EntityManager,
            row: any,
            rowCount: number
        ) => {}
        it('should throw an error', async () => {
            const upload = {
                filename: filename,
                mimetype: mimetype,
                encoding: encoding,
                createReadStream: () => {
                    return fs.createReadStream(
                        resolve(`tests/fixtures/empty.csv`)
                    )
                },
            } as Upload
            const fn = async () =>
                await readCSVFile(
                    connection.manager,
                    upload,
                    [dummyFn],
                    adminPermissions
                )
            await expect(fn()).to.be.rejectedWith(
                'Empty input file: ' + filename
            )
        })
    })

    context('when file header but no rows', () => {
        const filename = 'onlyHeader.csv'
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const dummyFn: CreateEntityRowCallback = async (
            manager: EntityManager,
            row: any,
            rowCount: number
        ) => {}
        it('should throw an error', async () => {
            const upload = {
                filename: filename,
                mimetype: mimetype,
                encoding: encoding,
                createReadStream: () => {
                    return fs.createReadStream(
                        resolve(`tests/fixtures/onlyHeader.csv`)
                    )
                },
            } as Upload
            const fn = async () =>
                await readCSVFile(
                    connection.manager,
                    upload,
                    [dummyFn],
                    adminPermissions
                )
            expect(fn()).to.be.rejectedWith('Empty input file: ' + filename)
        })
    })

    context('when incorrect file type', () => {
        const filename = 'asTxtFileType.txt'
        const mimetype = 'text/plain'
        const encoding = '7bit'
        const dummyFn: CreateEntityRowCallback = async (
            manager: EntityManager,
            row: any,
            rowCount: number
        ) => {}
        it('should throw an error', async () => {
            const upload = {
                filename: filename,
                mimetype: mimetype,
                encoding: encoding,
                createReadStream: () => {
                    return fs.createReadStream(
                        resolve(`tests/fixtures/asTxtFileType.txt`)
                    )
                },
            } as Upload
            const fn = async () =>
                await readCSVFile(
                    connection.manager,
                    upload,
                    [dummyFn],
                    adminPermissions
                )
            expect(fn()).to.be.rejectedWith('File must be in .csv format.')
        })
    })
})
