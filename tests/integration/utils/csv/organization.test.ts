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
        testClient = createTestClient(server)
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
        adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
    })

    context('when the organization name is not provided', () => {
        beforeEach(async () => {
            row = { ...row, organization_name: '' }
        })

        it('throws an error', async () => {
            const fn = () =>
                processOrganizationFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

            expect(fn()).to.be.rejected
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when the owner email or owner phone is not provided', () => {
        beforeEach(async () => {
            row = { ...row, owner_email: '', owner_phone: '' }
        })

        it('throws an error', async () => {
            const fn = () =>
                processOrganizationFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

            expect(fn()).to.be.rejected
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when the owner shortcode is invalid', () => {
        beforeEach(async () => {
            row = { ...row, owner_shortcode: '£$%' }
        })

        it('throws an error', async () => {
            const fn = () =>
                processOrganizationFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

            expect(fn()).to.be.rejected
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when the given organization already exists', () => {
        beforeEach(async () => {
            const existentOrganization = await createOrganization()
            await connection.manager.save(existentOrganization)

            row = {
                ...row,
                organization_name: String(
                    existentOrganization.organization_name
                ),
            }
        })

        it('throws an error', async () => {
            const fn = () =>
                processOrganizationFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

            expect(fn()).to.be.rejected
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.exist
        })
    })

    context('when the given owner already has an organization', () => {
        beforeEach(async () => {
            const existentOwner = await createUser()
            await connection.manager.save(existentOwner)

            const existentOrganization = await createOrganization(existentOwner)
            await connection.manager.save(existentOrganization)

            row = { ...row, owner_email: String(existentOwner.email) }
        })

        it('throws an error', async () => {
            const fn = () =>
                processOrganizationFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

            expect(fn()).to.be.rejected
            const organization = await Organization.findOne({
                where: { organization_name: row.organization_name },
            })

            expect(organization).to.be.undefined
        })
    })

    context('when all data provided is valid', () => {
        it('creates the organizations with its relations', async () => {
            let user
            let organization
            let organizationOwnership
            let organizationMembership

            await processOrganizationFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            organization = await Organization.findOneOrFail({
                where: { organization_name: row.organization_name },
            })
            user = await User.findOneOrFail({
                where: { my_organization: organization.organization_id },
            })
            organizationOwnership = await OrganizationOwnership.findOneOrFail({
                where: {
                    organization_id: organization.organization_id,
                    user_id: user.user_id,
                },
            })
            organizationMembership = await OrganizationMembership.findOneOrFail(
                {
                    where: {
                        organization_id: organization.organization_id,
                        user_id: user.user_id,
                    },
                }
            )

            expect(organization).to.exist
            expect(organization.status).eq('active')
            expect(organization.shortCode?.length).greaterThan(0)

            expect(user).to.exist
            expect(user.given_name).eq(row.owner_given_name)
            expect(user.family_name).eq(row.owner_family_name)
            expect(user.email).eq(row.owner_email)
            expect(user.status).eq('active')

            expect(organizationOwnership).to.exist
            expect(organizationOwnership.status).eq('active')

            expect(organizationMembership).to.exist
            expect(organizationMembership.status).eq('active')
            expect(organizationMembership.shortcode).eq(row.owner_shortcode)
        })
    })
})
