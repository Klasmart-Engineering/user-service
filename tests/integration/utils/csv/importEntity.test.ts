import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import fs from 'fs'

import { createTestConnection } from '../../../utils/testConnection'
import { processOrganizationFromCSVRow } from '../../../../src/utils/csv/organization'
import { createEntityFromCsvWithRollBack } from '../../../../src/utils/csv/importEntity'
import { Organization } from '../../../../src/entities/organization'
import { Upload } from '../../../../src/types/upload'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createServer } from '../../../../src/utils/createServer'
import { Model } from '../../../../src/model'
import { createTestClient } from '../../../utils/createTestClient'
import { createAdminUser } from '../../../utils/testEntities'

use(chaiAsPromised)

describe('createEntityFromCsvWithRollBack', () => {
    let connection: Connection
    let file: Upload
    let organizationCount: number
    let adminPermissions: UserPermissions

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        const testClient = createTestClient(server)

        const adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    after(async () => {
        await connection?.close()
    })

    context('when file to process has errors', () => {
        let fileName = 'example.csv'
        let fileStream = fs.createReadStream(
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
            const fn = () =>
                createEntityFromCsvWithRollBack(
                    connection,
                    file,
                    [processOrganizationFromCSVRow],
                    adminPermissions
                )
            expect(fn()).to.be.rejected

            organizationCount = await connection.manager
                .getRepository(Organization)
                .count()
            expect(organizationCount).eq(0)
        })
    })

    context('when file to process is valid', () => {
        let fileName = 'organizationsExample.csv'
        let fileStream = fs.createReadStream(
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
                [processOrganizationFromCSVRow],
                adminPermissions
            )
            organizationCount = await connection.manager
                .getRepository(Organization)
                .count()
            expect(organizationCount).gt(0)
        })
    })

    context('when dry run', () => {
        let fileName = 'organizationsExample.csv'
        let fileStream = fs.createReadStream(
            `tests/fixtures/${fileName}`,
            'utf-8'
        )
        let isDryRun = true

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
                [processOrganizationFromCSVRow],
                adminPermissions,
                isDryRun
            )
            organizationCount = await connection.manager
                .getRepository(Organization)
                .count()
            expect(organizationCount).eq(0)
        })
    })
})
