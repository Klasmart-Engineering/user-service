import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { Organization } from '../../../../src/entities/organization'
import { Permission } from '../../../../src/entities/permission'
import { Role } from '../../../../src/entities/role'
import { Model } from '../../../../src/model'
import { CSVError } from '../../../../src/types/csv/csvError'
import { RoleRow } from '../../../../src/types/csv/roleRow'
import { createServer } from '../../../../src/utils/createServer'
import { processRoleFromCSVRow } from '../../../../src/utils/csv/role'
import { createOrganization } from '../../../factories/organization.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { TestConnection } from '../../../utils/testConnection'
import { User } from '../../../../src/entities/user'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createAdminUser } from '../../../utils/testEntities'

use(chaiAsPromised)

describe('processRoleFromCSVRow', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let row: RoleRow
    let organization: Organization
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        organization = await createOrganization()
        organization.organization_name = 'Company 1'
        await connection.manager.save(organization)

        row = {
            organization_name: 'Company 1',
            role_name: 'Assistant',
            permission_id: 'add_teachers_to_class_20226',
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

        it('records an appropriate error and message', async () => {
            const rowErrors = await processRoleFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(programRowError.message).to.equal(
                'On row number 1, organization name is required.'
            )

            const role = await Role.findOne({
                where: {
                    role_name: row.role_name,
                    status: 'active',
                    system_role: false,
                    organization,
                },
            })

            expect(role).to.be.undefined
        })
    })

    context('when the role name is not provided', () => {
        beforeEach(() => {
            row = { ...row, role_name: '' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processRoleFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(programRowError.message).to.equal(
                'On row number 1, role name is required.'
            )

            const role = await Role.findOne({
                where: {
                    role_name: row.role_name,
                    status: 'active',
                    system_role: false,
                    organization,
                },
            })

            expect(role).to.be.undefined
        })
    })

    context('when the permission id is not provided', () => {
        beforeEach(() => {
            row = { ...row, permission_id: '' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processRoleFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_MISSING_REQUIRED')
            expect(programRowError.message).to.equal(
                'On row number 1, permission id is required.'
            )

            const role = await Role.findOne({
                where: {
                    role_name: row.role_name,
                    status: 'active',
                    system_role: false,
                    organization,
                },
            })

            expect(role).to.be.undefined
        })
    })

    context("when the provided organization doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Company 10' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processRoleFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_NONE_EXIST_ENTITY')
            expect(programRowError.message).to.equal(
                `On row number 1, "${row.organization_name}" organization doesn't exist.`
            )

            const role = await Role.findOne({
                where: {
                    role_name: row.role_name,
                    status: 'active',
                    system_role: false,
                    organization,
                },
            })

            expect(role).to.be.undefined
        })
    })

    context("when the provided permission id doesn't exist", () => {
        beforeEach(() => {
            row = { ...row, permission_id: 'non_existent_permission123' }
        })

        it('records an appropriate error and message', async () => {
            const rowErrors = await processRoleFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(rowErrors).to.have.length(1)

            const programRowError = rowErrors[0]
            expect(programRowError.code).to.equal('ERR_CSV_NONE_EXIST_ENTITY')
            expect(programRowError.message).to.equal(
                `On row number 1, "${row.permission_id}" permission doesn't exist.`
            )

            const role = await Role.findOne({
                where: {
                    role_name: row.role_name,
                    status: 'active',
                    system_role: false,
                    organization,
                },
            })

            expect(role).to.be.undefined
        })
    })

    context(
        'when the provided permission already exists in the current role',
        () => {
            beforeEach(async () => {
                const permissions: Permission[] = []
                const permissionFound = await Permission.findOneOrFail(
                    row.permission_id
                )
                const role = new Role()

                permissions.push(permissionFound)
                role.role_name = row.role_name
                role.organization = Promise.resolve(organization)
                role.permissions = Promise.resolve(permissions)
                await connection.manager.save(role)
            })

            it('records an appropriate error and message', async () => {
                const rowErrors = await processRoleFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                expect(rowErrors).to.have.length(1)

                const programRowError = rowErrors[0]
                expect(programRowError.code).to.equal(
                    'ERR_CSV_DUPLICATE_CHILD_ENTITY'
                )
                expect(programRowError.message).to.equal(
                    `On row number 1, "${row.permission_id}" permission already exists for "${row.role_name}" role.`
                )

                const role = await Role.findOne({
                    where: {
                        role_name: row.role_name,
                        status: 'active',
                        system_role: false,
                        organization,
                    },
                })

                expect(role).to.exist
            })
        }
    )

    context('when all data provided is valid', () => {
        it('creates the roles with its relations', async () => {
            await processRoleFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const role = await Role.findOneOrFail({
                where: {
                    role_name: row.role_name,
                    status: 'active',
                    system_role: false,
                    organization,
                },
            })

            const organizationInRole = await role.organization

            expect(role).to.exist
            expect(role.role_name).eq(row.role_name)
            expect(role.system_role).eq(false)
            expect(role.status).eq('active')
            expect(organizationInRole?.organization_name).eq(
                row.organization_name
            )
        })
    })
})
