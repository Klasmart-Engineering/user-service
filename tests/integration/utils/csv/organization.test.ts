import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createTestConnection } from '../../../utils/testConnection'
import { Organization } from '../../../../src/entities/organization'
import { User } from '../../../../src/entities/user'
import { OrganizationOwnership } from '../../../../src/entities/organizationOwnership'
import { OrganizationMembership } from '../../../../src/entities/organizationMembership'
import { OrganizationRow } from '../../../../src/types/csv/organizationRow'
import { processOrganizationFromCSVRow } from '../../../../src/utils/csv/organization'
import { createOrganization } from '../../../factories/organization.factory'
import { createUser } from '../../../factories/user.factory'
import { CSVError } from '../../../../src/types/csv/csvError'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'
import { Status } from '../../../../src/entities/status'
import validationConstants from '../../../../src/entities/validations/constants'
import csvErrorConstants from '../../../../src/types/errors/csv/csvErrorConstants'
import { createOrganizationOwnership } from '../../../factories/organizationOwnership.factory'

use(chaiAsPromised)

describe('processOrganizationFromCSVRow', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let row: OrganizationRow
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        row = {
            organization_name: 'Larson-Wyman',
            owner_given_name: 'Bethina',
            owner_family_name: 'Presnell',
            owner_shortcode: 'Q9N2C0H',
            owner_email: 'bpresnellj@marketwatch.com',
            owner_phone: '+232 938 966 2102',
        }
        fileErrors = []
        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    context('when the organization name is not provided', () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it('returns a ERR_CSV_NONE_EXIST_ENTITY CSVError', async () => {
            const errors = await processOrganizationFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            expect(errors).to.deep.equal([
                {
                    code: csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
                    column: 'organization_name',
                    entity: 'organization',
                    // TODO fix stringInject to not ignore falsey parameters
                    message:
                        'On row number 1, "{name}" organization doesn\'t exist.',
                    name: '',
                    row: 1,
                },
            ])
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when the owner email or owner phone is not provided', () => {
        beforeEach(() => {
            row = { ...row, owner_email: '', owner_phone: '' }
        })

        it('returns a ERR_CSV_MISSING_REQUIRED_EITHER CSVError', async () => {
            const errors = await processOrganizationFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            expect(errors).to.deep.equal([
                {
                    attribute: 'email',
                    code: csvErrorConstants.ERR_CSV_MISSING_REQUIRED_EITHER,
                    column: 'owner_email',
                    entity: 'user',
                    message:
                        'On row number 1, user email or user phone is required.',
                    other_attribute: 'phone',
                    other_entity: 'user',
                    row: 1,
                },
            ])
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when the owner shortcode is invalid', () => {
        beforeEach(() => {
            row = { ...row, owner_shortcode: '£$%' }
        })

        it('returns a ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX CSVError', async () => {
            const errors = await processOrganizationFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            expect(errors).to.deep.equal([
                {
                    attribute: 'short_code',
                    code:
                        csvErrorConstants.ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
                    column: 'owner_shortcode',
                    entity: 'user',
                    max: validationConstants.SHORTCODE_MAX_LENGTH,
                    message: `On row number 1, user short_code must only contain uppercase letters, numbers and must not greater than ${validationConstants.SHORTCODE_MAX_LENGTH} characters.`,
                    row: 1,
                },
            ])
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when the given organization already exists', () => {
        let existentOrganization: Organization
        beforeEach(async () => {
            existentOrganization = await createOrganization().save()

            row = {
                ...row,
                organization_name: String(
                    existentOrganization.organization_name
                ),
            }
        })

        it('returns a ERR_CSV_DUPLICATE_ENTITY CSVError', async () => {
            const errors = await processOrganizationFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            expect(errors).to.deep.equal([
                {
                    code: csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
                    column: 'organization_name',
                    entity: 'organization',
                    message: `On row number 1, "${existentOrganization.organization_name}" organization already exists.`,
                    name: existentOrganization?.organization_name,
                    row: 1,
                },
            ])
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.exist
        })
    })

    context('when the given owner already has an organization', () => {
        beforeEach(async () => {
            const existentOwner = await createUser().save()

            const organization = await createOrganization(existentOwner).save()

            await createOrganizationOwnership({
                user: existentOwner,
                organization,
            }).save()

            row = { ...row, owner_email: String(existentOwner.email) }
        })

        it.skip('returns a ERR_ONE_ACTIVE_ORGANIZATION_PER_USER CSVError', async () => {
            // Currently this test will not pass because:
            // - the `ownerUploaded` check doesn't include personal information (i.e. given_name and family_name)
            // - the `getUserByEmailOrPhone` (to find the existing Owner) relies on deterministic UUIDs
            // i.e. `user_id` is generated from a hash based on the email/phone
            // - uppercase emails are not normalized to lowercase
            // TODO fix processOrganizationFromCSVRow implementation - UD-1082
            const errors = await processOrganizationFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            expect(errors).to.deep.equal([
                {
                    code:
                        csvErrorConstants.ERR_ONE_ACTIVE_ORGANIZATION_PER_USER,
                    column: 'organization_name',
                    row: 1,
                    message:
                        csvErrorConstants.MSG_ERR_ONE_ACTIVE_ORGANIZATION_PER_USER,
                },
            ])
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when all data provided is valid', () => {
        it('creates the organizations with its relations', async () => {
            const errors = await processOrganizationFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            expect(errors).to.deep.equal([])

            const organization = await Organization.findOneOrFail({
                where: { organization_name: row.organization_name },
            })
            const user = await User.findOneOrFail({
                where: { my_organization: organization.organization_id },
            })
            const organizationOwnership = await OrganizationOwnership.findOneOrFail(
                {
                    where: {
                        organization_id: organization.organization_id,
                        user_id: user.user_id,
                    },
                }
            )
            const organizationMembership = await OrganizationMembership.findOneOrFail(
                {
                    where: {
                        organization_id: organization.organization_id,
                        user_id: user.user_id,
                    },
                }
            )

            expect(organization).to.exist
            expect(organization.status).eq(Status.ACTIVE)
            expect(organization.shortCode?.length).greaterThan(0)

            expect(user).to.exist
            expect(user.given_name).eq(row.owner_given_name)
            expect(user.family_name).eq(row.owner_family_name)
            expect(user.email).eq(row.owner_email)
            expect(user.status).eq(Status.ACTIVE)

            expect(organizationOwnership).to.exist
            expect(organizationOwnership.status).eq(Status.ACTIVE)

            expect(organizationMembership).to.exist
            expect(organizationMembership.status).eq(Status.ACTIVE)
            expect(organizationMembership.shortcode).eq(row.owner_shortcode)
        })
    })
})
