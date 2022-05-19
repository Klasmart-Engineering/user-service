import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { expect, use } from 'chai'

import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { TestConnection } from '../../../utils/testConnection'
import { Organization } from '../../../../src/entities/organization'
import { Subcategory } from '../../../../src/entities/subcategory'
import { createOrganization } from '../../../factories/organization.factory'
import { processSubCategoriesFromCSVRow } from '../../../../src/utils/csv/subCategories'
import { SubCategoryRow } from '../../../../src/types/csv/subCategoryRow'
import { CSVError } from '../../../../src/types/csv/csvError'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'

use(chaiAsPromised)

describe('processSubCategoriesFromCSVRow', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let row: SubCategoryRow
    let expectedOrg: Organization
    let fileErrors: CSVError[] = []
    let adminUser: User
    let adminPermissions: UserPermissions

    const orgName = 'my-org'
    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        fileErrors = []
        expectedOrg = createOrganization()
        expectedOrg.organization_name = orgName
        await connection.manager.save(expectedOrg)

        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    it('should create a class with school and program when present', async () => {
        row = { organization_name: orgName, subcategory_name: 'sc1' }
        await processSubCategoriesFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        await Subcategory.findOneByOrFail({
            name: 'sc1',
            organization: { organization_id: expectedOrg.organization_id },
        })
    })

    it('should record an appropriate error and message for missing organization', async () => {
        row = { organization_name: '', subcategory_name: 'sc1' }
        const rowErrors = await processSubCategoriesFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const subRowError = rowErrors[0]
        expect(subRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
        expect(subRowError.message).to.equal(
            'On row number 1, organization name is required.'
        )

        const dbSubCategories = await Subcategory.find()
        expect(dbSubCategories.length).to.equal(0)
    })

    it('should record an appropriate error and message for missing sub category', async () => {
        row = { organization_name: 'test', subcategory_name: '' }
        const rowErrors = await processSubCategoriesFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )
        expect(rowErrors).to.have.length(1)

        const subRowError = rowErrors[0]
        expect(subRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
        expect(subRowError.message).to.equal(
            'On row number 1, subCategory name is required.'
        )

        const dbSubCategories = await Subcategory.find()
        expect(dbSubCategories.length).to.equal(0)
    })
})
