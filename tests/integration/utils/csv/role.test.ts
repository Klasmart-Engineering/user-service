import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
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
import { createTestConnection } from '../../../utils/testConnection'

use(chaiAsPromised)

describe('processRoleFromCSVRow', () => {
    let connection: Connection
    let testClient: ApolloServerTestClient
    let row: RoleRow
    let organization: Organization
    let fileErrors: CSVError[]

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        organization = await createOrganization()
        organization.organization_name = 'Company 1'
        await connection.manager.save(organization)

        row = {
            organization_name: 'Company 1',
            role_name: 'Asistant',
            permission_id: 'add_teachers_to_class_20226',
        }
    })

    context('when the organization name is not provided', () => {
        beforeEach(() => {
            row = { ...row, organization_name: '' }
        })

        it('throws an error', async () => {
            const fn = () =>
                processRoleFromCSVRow(connection.manager, row, 1, fileErrors)

            await expect(fn()).to.be.rejected
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

        it('throws an error', async () => {
            const fn = () =>
                processRoleFromCSVRow(connection.manager, row, 1, fileErrors)

            await expect(fn()).to.be.rejected
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

        it('throws an error', async () => {
            const fn = () =>
                processRoleFromCSVRow(connection.manager, row, 1, fileErrors)

            await expect(fn()).to.be.rejected
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

    context("when the provided organization doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, organization_name: 'Company 10' }
        })

        it('throws an error', async () => {
            const fn = () =>
                processRoleFromCSVRow(connection.manager, row, 1, fileErrors)

            await expect(fn()).to.be.rejected
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

    context("when the provided permission id doesn't exists", () => {
        beforeEach(() => {
            row = { ...row, permission_id: 'non_existent_permission123' }
        })

        it('throws an error', async () => {
            const fn = () =>
                processRoleFromCSVRow(connection.manager, row, 1, fileErrors)

            await expect(fn()).to.be.rejected
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
                let permissions: Permission[] = []
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

            it('throws an error', async () => {
                const fn = () =>
                    processRoleFromCSVRow(
                        connection.manager,
                        row,
                        1,
                        fileErrors
                    )

                await expect(fn()).to.be.rejected
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
            await processRoleFromCSVRow(connection.manager, row, 1, fileErrors)

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
