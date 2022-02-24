import { expect, use } from 'chai'
import { EntityManager, getConnection } from 'typeorm'
import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { TestConnection } from '../../../utils/testConnection'
import { resolve } from 'path'
import fs from 'fs'
import chaiAsPromised from 'chai-as-promised'
import { readCSVFile } from '../../../../src/utils/csv/readFile'
import { Upload } from '../../../../src/types/upload'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { CreateEntityRowCallback } from '../../../../src/types/csv/createEntityRowCallback'
import { CSVError } from '../../../../src/types/csv/csvError'
import { processUserFromCSVRow } from '../../../../src/utils/csv/user'

use(chaiAsPromised)

describe('read file', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let adminPermissions: UserPermissions

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        const adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    context('when file data is empty', () => {
        const filename = 'empty.csv'
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const dummyFn: CreateEntityRowCallback = async (
            manager: EntityManager,
            row: any,
            rowCount: number
        ) => {
            return []
        }
        it('should throw an error', async () => {
            const upload: Upload = {
                filename: filename,
                mimetype: mimetype,
                encoding: encoding,
                createReadStream: () => {
                    return fs.createReadStream(
                        resolve(`tests/fixtures/empty.csv`)
                    )
                },
            }

            await expect(
                readCSVFile(
                    connection.manager,
                    upload,
                    [dummyFn],
                    adminPermissions
                )
            ).to.eventually.be.rejectedWith(`The ${filename} file is empty`)
        })
    })

    context('when there are dynamic constraint errors in multiple rows', () => {
        it("validates all rows and doesn't terminate after the first", async () => {
            try {
                await readCSVFile(
                    connection.manager,
                    {
                        filename: `tests/fixtures/usersWithDynamicConstraintErrors.csv`,
                        mimetype: 'text/csv',
                        encoding: '7bit',
                        createReadStream: () => {
                            return fs.createReadStream(
                                resolve(
                                    `tests/fixtures/usersWithDynamicConstraintErrors.csv`
                                )
                            )
                        },
                    },
                    [processUserFromCSVRow],
                    adminPermissions
                )
                expect(false).to.eq(true) // should never reach here
            } catch (e) {
                const errors: CSVError[] = e as CSVError[]
                expect(errors.length).to.eq(2)
                expect(errors[0].row).to.eq(1)
                expect(errors[1].row).to.eq(2)
                expect(errors[0].code).to.eq('ERR_NON_EXISTENT_ENTITY')
                expect(errors[1].code).to.eq('ERR_NON_EXISTENT_ENTITY')
            }
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
        ) => {
            return []
        }
        it('should throw an error', async () => {
            const upload: Upload = {
                filename: filename,
                mimetype: mimetype,
                encoding: encoding,
                createReadStream: () => {
                    return fs.createReadStream(
                        resolve(`tests/fixtures/onlyHeader.csv`)
                    )
                },
            }

            try {
                await readCSVFile(
                    connection.manager,
                    upload,
                    [dummyFn],
                    adminPermissions
                )

                expect.fail(`Function incorrectly resolved.`)
            } catch (e) {
                expect(e)
                    .to.have.property('message')
                    .equal(`The ${filename} file is empty.`)
            }
        })
    })

    context('when incorrect file type', () => {
        const filename = 'example.txt'
        const mimetype = 'text/plain'
        const encoding = '7bit'
        const dummyFn: CreateEntityRowCallback = async (
            manager: EntityManager,
            row: any,
            rowCount: number
        ) => {
            return []
        }
        it('should throw an error', async () => {
            const upload: Upload = {
                filename: filename,
                mimetype: mimetype,
                encoding: encoding,
                createReadStream: () => {
                    return fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )
                },
            }

            try {
                await readCSVFile(
                    connection.manager,
                    upload,
                    [dummyFn],
                    adminPermissions
                )

                expect.fail(`Function incorrectly resolved.`)
            } catch (e) {
                expect(e)
                    .to.have.property('message')
                    .equal('File must be in CSV format.')
            }
        })
    })
})
