import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { expect, use } from 'chai'
import fs from 'fs'

import { TestConnection } from '../../../utils/testConnection'
import { processOrganizationFromCSVRow } from '../../../../src/utils/csv/organization'
import { createEntityFromCsvWithRollBack } from '../../../../src/utils/csv/importEntity'
import { Organization } from '../../../../src/entities/organization'
import { Upload } from '../../../../src/types/upload'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createServer } from '../../../../src/utils/createServer'
import { legacyCsvRowFunctionWrapper, Model } from '../../../../src/model'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createAdminUser } from '../../../utils/testEntities'

use(chaiAsPromised)

describe('createEntityFromCsvWithRollBack', () => {
    let connection: TestConnection
    let file: Upload
    let organizationCount: number
    let adminPermissions: UserPermissions
    let testClient: ApolloServerTestClient

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

    context('when file to process has errors', () => {
        const fileName = 'example.csv'
        const fileStream = fs.createReadStream(
            `tests/fixtures/${fileName}`,
            'utf-8'
        )

        beforeEach(async () => {
            file = {
                filename: fileName,
                mimetype: 'text/csv',
                encoding: '7bit',
                createReadStream: () => fileStream,
            }
        })

        it('does not create any entities', async () => {
            await expect(
                createEntityFromCsvWithRollBack(
                    connection,
                    file,
                    [
                        (
                            manager,
                            rows,
                            rowNumber,
                            fileErrors,
                            userPermissions,
                            queryResultCache
                        ) =>
                            legacyCsvRowFunctionWrapper(
                                manager,
                                rows,
                                rowNumber,
                                fileErrors,
                                userPermissions,
                                queryResultCache,
                                processOrganizationFromCSVRow
                            ),
                    ],
                    adminPermissions,
                    undefined
                )
            ).to.be.rejected

            organizationCount = await connection.manager
                .getRepository(Organization)
                .count()
            expect(organizationCount).eq(0)
        })
    })

    context('when file to process is valid', () => {
        const fileName = 'organizationsExample.csv'
        const fileStream = fs.createReadStream(
            `tests/fixtures/${fileName}`,
            'utf-8'
        )

        beforeEach(async () => {
            file = {
                filename: fileName,
                mimetype: 'text/csv',
                encoding: '7bit',
                createReadStream: () => fileStream,
            }
        })

        it('creates all the expected entities', async () => {
            await createEntityFromCsvWithRollBack(
                connection,
                file,
                [
                    (
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache
                    ) =>
                        legacyCsvRowFunctionWrapper(
                            manager,
                            rows,
                            rowNumber,
                            fileErrors,
                            userPermissions,
                            queryResultCache,
                            processOrganizationFromCSVRow
                        ),
                ],
                adminPermissions,
                undefined
            )
            organizationCount = await connection.manager
                .getRepository(Organization)
                .count()
            expect(organizationCount).gt(0)
        })
    })

    context('when dry run', () => {
        const fileName = 'organizationsExample.csv'
        const fileStream = fs.createReadStream(
            `tests/fixtures/${fileName}`,
            'utf-8'
        )
        const isDryRun = true

        beforeEach(async () => {
            file = {
                filename: fileName,
                mimetype: 'text/csv',
                encoding: '7bit',
                createReadStream: () => fileStream,
            }
        })

        it('no entities are created', async () => {
            await createEntityFromCsvWithRollBack(
                connection,
                file,
                [
                    (
                        manager,
                        rows,
                        rowNumber,
                        fileErrors,
                        userPermissions,
                        queryResultCache
                    ) =>
                        legacyCsvRowFunctionWrapper(
                            manager,
                            rows,
                            rowNumber,
                            fileErrors,
                            userPermissions,
                            queryResultCache,
                            processOrganizationFromCSVRow
                        ),
                ],
                adminPermissions,
                undefined,
                isDryRun
            )
            organizationCount = await connection.manager
                .getRepository(Organization)
                .count()
            expect(organizationCount).eq(0)
        })
    })
})
