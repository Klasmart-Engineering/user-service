import { expect } from 'chai'
import { Organization } from '../../../../../src/entities/organization'
import { User } from '../../../../../src/entities/user'
import { Model } from '../../../../../src/model'
import { UserPermissions } from '../../../../../src/permissions/userPermissions'
import { CSVError } from '../../../../../src/types/csv/csvError'
import {
    ValidatedCSVEntities,
    validateOrgUploadPermsForCSV,
    ValidationStateAndEntities,
} from '../../../../../src/utils/csv/validations/user'
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
import { createRole } from '../../../../factories/role.factory'
import { PermissionName } from '../../../../../src/permissions/permissionNames'
import { OrganizationMembership } from '../../../../../src/entities/organizationMembership'
import { addRoleToOrganizationMembership } from '../../../../utils/operations/organizationMembershipOps'

describe('processUsersFromCSVRows validation', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    describe('validateOrgsInCSV', () => {
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
                const org1Membership = createOrganizationMembership({
                    user: user,
                    organization: org1,
                })
                const org2Membership = createOrganizationMembership({
                    user: user,
                    organization: org2,
                })
                await connection.manager.save([org1Membership, org2Membership])

                const result = await validateOrgsInCSV(
                    userRowsInCSV,
                    userPermissions,
                    new ValidationStateAndEntities()
                )

                expect(result.rowErrors).to.be.empty
            })

            it('returns an error if client user is not a member of an org', async () => {
                const org1Membership = createOrganizationMembership({
                    user: user,
                    organization: org1,
                })
                await connection.manager.save(org1Membership)

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

                const result = await validateOrgsInCSV(
                    userRowsInCSV,
                    userPermissions,
                    new ValidationStateAndEntities()
                )

                expect(result.rowErrors).to.deep.equal(rowErrors)
            })

            it('makes one DB call for all unique org names in CSV together', async () => {
                await createOrganizationMembership({
                    user: user,
                    organization: org1,
                }).save()
                await createOrganizationMembership({
                    user: user,
                    organization: org2,
                }).save()

                connection.logger.reset()
                await validateOrgsInCSV(
                    userRowsInCSV,
                    userPermissions,
                    new ValidationStateAndEntities()
                )
                expect(connection.logger.count).to.equal(1)
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

            it('returns an error if an org named in the CSV does not exist (to the client user)', async () => {
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

                const result = await validateOrgsInCSV(
                    userRowsInCSV,
                    userPermissions,
                    new ValidationStateAndEntities()
                )

                expect(result.rowErrors).to.deep.equal(rowErrors)
            })
        })
    })

    describe('validateOrgUploadPermsForCSV', () => {
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

        context('orgs with perms for client user', () => {
            let uniqueExistentOrgs: Organization[] = []
            let org1: Organization
            let org2: Organization
            let user: User
            let userPermissions: UserPermissions
            let org1Membership: OrganizationMembership
            let org2Membership: OrganizationMembership
            let validatedCSVEntities: ValidatedCSVEntities
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
                org1Membership = createOrganizationMembership({
                    user: user,
                    organization: org1,
                })
                org2Membership = createOrganizationMembership({
                    user: user,
                    organization: org2,
                })
                await connection.manager.save([org1Membership, org2Membership])
                validatedCSVEntities = { orgs: [org1, org2] } // At this stage in validation, orgs should be validated
            })

            it('returns no errors when client user has upload perms in all orgs', async () => {
                const uploadRole1 = await createRole('Upload Role', org1, {
                    permissions: [PermissionName.upload_users_40880],
                }).save()
                const uploadRole2 = await createRole('Upload Role', org2, {
                    permissions: [PermissionName.upload_users_40880],
                }).save()

                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    org1.organization_id,
                    uploadRole1.role_id
                )
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    org2.organization_id,
                    uploadRole2.role_id
                )

                const result = await validateOrgUploadPermsForCSV(
                    userRowsInCSV,
                    userPermissions,
                    new ValidationStateAndEntities(
                        undefined,
                        validatedCSVEntities
                    )
                )

                expect(result.rowErrors).to.be.empty
            })

            it('returns an error if client user does not have upload perms for an org', async () => {
                const uploadRole = await createRole('Upload Role', org1, {
                    permissions: [PermissionName.upload_users_40880],
                }).save()
                await addRoleToOrganizationMembership(
                    testClient,
                    user.user_id,
                    org1.organization_id,
                    uploadRole.role_id
                )
                // No upload permission in org 2

                const result = await validateOrgUploadPermsForCSV(
                    userRowsInCSV,
                    userPermissions,
                    new ValidationStateAndEntities(
                        undefined,
                        validatedCSVEntities
                    )
                )

                addCsvError(
                    rowErrors,
                    customErrors.unauthorized_org_upload.code,
                    3,
                    'organization_name',
                    customErrors.unauthorized_org_upload.message,
                    {
                        entity: 'user',
                        organizationName: org2.organization_name,
                    }
                )

                expect(result.rowErrors).to.deep.equal(rowErrors)
            })
        })
    })
})
