import { expect } from 'chai'
import { Organization } from '../../../../../src/entities/organization'
import { User } from '../../../../../src/entities/user'
import { Model } from '../../../../../src/model'
import { UserPermissions } from '../../../../../src/permissions/userPermissions'
import { CSVError } from '../../../../../src/types/csv/csvError'
import { UserRow } from '../../../../../src/types/csv/userRow'
import { customErrors } from '../../../../../src/types/errors/customError'
import { createServer } from '../../../../../src/utils/createServer'
import { addCsvError } from '../../../../../src/utils/csv/csvUtils'
import { validateOrgsInCSV } from '../../../../../src/utils/csv/validations/user'
import { createOrganization } from '../../../../factories/organization.factory'
import { createOrganizationMembership } from '../../../../factories/organizationMembership.factory'
import { createUser } from '../../../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../../utils/createTestClient'
import { userToPayload } from '../../../../utils/operations/userOps'
import {
    createTestConnection,
    TestConnection,
} from '../../../../utils/testConnection'

describe('validateOrgsInCSV', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    const userRowsInCSV = [
        {
            organization_name: 'Org1',
            user_given_name: 'Test',
            user_family_name: 'User1',
            user_gender: 'Female',
            organization_role_name: 'Bread Role',
        },
        {
            organization_name: 'Org1',
            user_given_name: 'Test',
            user_family_name: 'User2',
            user_gender: 'Male',
            organization_role_name: 'Lobster Role',
        },
        {
            organization_name: 'Org2',
            user_given_name: 'Test',
            user_family_name: 'User3',
            user_gender: 'Female',
            organization_role_name: 'Spring Role',
        },
    ]

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    context('unique orgs exist', () => {
        let uniqueExistentOrgs: Organization[] = []
        let org1: Organization
        let org2: Organization
        let user: User
        let userPermissions: UserPermissions
        const rowErrors: CSVError[] = []

        beforeEach(async () => {
            user = await createUser().save()
            userPermissions = new UserPermissions(userToPayload(user))
            org1 = createOrganization()
            org1.organization_name = 'Org1'
            org2 = createOrganization()
            org2.organization_name = 'Org2'
            uniqueExistentOrgs = [org1, org2]
            await connection.manager.save(uniqueExistentOrgs)
        })

        it('returns no errors when client user is a member of them', async () => {
            await createOrganizationMembership({
                user: user,
                organization: org1,
            }).save()
            await createOrganizationMembership({
                user: user,
                organization: org2,
            }).save()

            expect(
                await validateOrgsInCSV(
                    userRowsInCSV,
                    userPermissions,
                    rowErrors
                )
            ).to.be.empty
        })

        it('returns an error if client user is not a member of an org', async () => {
            await createOrganizationMembership({
                user: user,
                organization: org1,
            }).save()

            addCsvError(
                rowErrors,
                customErrors.nonexistent_entity.code,
                3,
                'organization_name',
                customErrors.nonexistent_entity.message,
                {
                    entity: 'Organization',
                    attribute: 'Name',
                    entityName: org2.organization_name,
                }
            )

            expect(
                await validateOrgsInCSV(
                    userRowsInCSV,
                    userPermissions,
                    rowErrors
                )
            ).to.deep.equal(rowErrors)
        })

        it('makes one DB call per unique org name', async () => {
            await createOrganizationMembership({
                user: user,
                organization: org1,
            }).save()
            await createOrganizationMembership({
                user: user,
                organization: org2,
            }).save()

            connection.logger.reset()
            await validateOrgsInCSV(userRowsInCSV, userPermissions, rowErrors)
            expect(connection.logger.count).to.equal(2)
        })
    })

    context('some unique orgs do not exist', () => {
        let uniqueExistentOrgs: Organization[] = []
        let org1: Organization
        // Org2 does not exist this time
        let user: User
        let userPermissions: UserPermissions
        const rowErrors: CSVError[] = []

        beforeEach(async () => {
            user = await createUser().save()
            userPermissions = new UserPermissions(userToPayload(user))
            org1 = createOrganization()
            org1.organization_name = 'Org1'
            uniqueExistentOrgs = [org1]
            await connection.manager.save(uniqueExistentOrgs)
        })

        it('returns an error if an org named in the CSV does not exist', async () => {
            await createOrganizationMembership({
                user: user,
                organization: org1,
            }).save()

            addCsvError(
                rowErrors,
                customErrors.nonexistent_entity.code,
                3,
                'organization_name',
                customErrors.nonexistent_entity.message,
                {
                    entity: 'Organization',
                    attribute: 'Name',
                    entityName: userRowsInCSV[2].organization_name,
                }
            )

            expect(
                await validateOrgsInCSV(
                    userRowsInCSV,
                    userPermissions,
                    rowErrors
                )
            ).to.deep.equal(rowErrors)
        })
    })
})
