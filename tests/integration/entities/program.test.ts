import { expect, use } from 'chai'
import { getConnection } from 'typeorm'
import chaiAsPromised from 'chai-as-promised'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    addUserToOrganizationAndValidate,
    createRole,
} from '../../utils/operations/organizationOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import { getNonAdminAuthToken, getAdminAuthToken } from '../../utils/testConfig'
import { createProgram } from '../../factories/program.factory'
import { createServer } from '../../../src/utils/createServer'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'
import { createOrganization } from '../../factories/organization.factory'
import { TestConnection } from '../../utils/testConnection'
import { deleteProgram } from '../../utils/operations/programOps'
import { grantPermission } from '../../utils/operations/roleOps'
import { Model } from '../../../src/model'
import { Organization } from '../../../src/entities/organization'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { Program } from '../../../src/entities/program'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'

use(chaiAsPromised)

describe('program', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let user: User
    let org: Organization
    let program: Program
    let organizationId: string
    let userId: string

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        user = await createAdminUser(testClient)
        userId = user.user_id

        org = createOrganization()
        await connection.manager.save(org)
        organizationId = org.organization_id
        program = createProgram(org)
        await connection.manager.save(program)
    })
})
