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
import { processUserFromCSVRows } from '../../../../src/utils/csv/user'
import { addCsvError } from '../../../../src/utils/csv/csvUtils'
import { customErrors } from '../../../../src/types/errors/customError'
import { config } from '../../../../src/config/config'

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
                    [processUserFromCSVRows],
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
            rows: any,
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
            rows: any,
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

    context(
        'when there are more rows then MUTATION_MAX_INPUT_ARRAY_SIZE',
        () => {
            const filename = 'users_example_big.csv'
            const upload: Upload = {
                filename: filename,
                mimetype: 'text/csv',
                encoding: '7bit',
                createReadStream: () => {
                    return fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )
                },
            }
            it('should invokes the callback with correct parameters', async () => {
                const expectedBatches = [
                    {
                        rowsLength: config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE,
                        rowCount: 1,
                    },
                    {
                        rowsLength: 1,
                        rowCount: 51,
                    },
                ]
                await readCSVFile(
                    connection.manager,
                    upload,
                    [
                        async (
                            manager: EntityManager,
                            rows: any,
                            rowCount: number
                        ) => {
                            const expectedBatch = expectedBatches.shift()!
                            expect(rows).to.have.length(
                                expectedBatch.rowsLength
                            )
                            expect(rowCount).to.eq(expectedBatch.rowCount)
                            return []
                        },
                    ],
                    adminPermissions
                )
            })

            it('collects errors returned from the callbacks', async () => {
                const error = await expect(
                    readCSVFile(
                        connection.manager,
                        upload,
                        [
                            async (
                                manager: EntityManager,
                                rows: any,
                                rowCount: number
                            ) => {
                                const rowErrors: CSVError[] = []
                                addCsvError(
                                    rowErrors,
                                    customErrors.nonexistent_entity.code,
                                    rowCount,
                                    'organization_name',
                                    customErrors.nonexistent_entity.message,
                                    {
                                        entity: 'Organization',
                                        attribute: 'Name',
                                        entityName: 'fake entity name',
                                    }
                                )
                                return rowErrors
                            },
                        ],
                        adminPermissions
                    )
                ).to.eventually.be.rejected
                // one per callback invocation
                expect(error).to.have.length(2)
            })
        }
    )
})
