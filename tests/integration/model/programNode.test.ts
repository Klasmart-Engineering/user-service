import { expect, use } from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'
import { Program } from '../../../src/entities/program'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { ProgramConnectionNode } from '../../../src/types/graphQL/programConnectionNode'
import { createServer } from '../../../src/utils/createServer'
import { createClass } from '../../factories/class.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createProgram } from '../../factories/program.factory'
import { createSchool } from '../../factories/school.factory'
import {
    createUsers,
    ADMIN_EMAIL,
    createAdminUser,
} from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { program2Nodes, programNode } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'

use(deepEqualInAnyOrder)

describe('programNode', () => {
    let program1: Program
    let program2: Program
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

    context('data', () => {
        beforeEach(async () => {
            program1 = await Program.save(createProgram())
            program2 = await Program.save(createProgram())
        })

        it('populates a ProgramConnectionNode with the requested Program entity', async () => {
            const programNodeResponse = await programNode(
                testClient,
                { authorization: getAdminAuthToken() },
                program1.id
            )
            expect(programNodeResponse).to.deep.equal({
                id: program1.id,
                name: program1.name,
                status: program1.status,
                system: program1.system,
            } as Required<ProgramConnectionNode>)
        })

        it('makes just one call to the database', async () => {
            connection.logger.reset()
            await program2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                program1.id,
                program2.id
            )
            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('permissions', () => {
        let user: User
        let admin: User
        let users: User[]
        let org1: Organization
        let org2: Organization
        let org1Programs: Program[] = []
        let org2Programs: Program[] = []
        let orgMembership: OrganizationMembership
        let programs: Program[] = []
        let school: School
        let class1: Class
        let class2: Class
        const programsCount = 12

        beforeEach(async () => {
            users = await User.save(createUsers(9))
            user = users[0]
            admin = createAdminUser()
            org1 = createOrganization(admin)
            org2 = createOrganization(admin)
            await connection.manager.save([org1, org2])
            orgMembership = createOrganizationMembership({
                user,
                organization: org1,
            })
            await orgMembership.save()

            school = createSchool(org1)
            class1 = createClass([school])
            class2 = createClass([school])

            org1Programs = []
            org2Programs = []
            programs = []

            for (let i = 0; i < programsCount / 2; i++) {
                const program = createProgram(org1)
                program.name = `program ${i}`
                program.system = i % 2 === 0
                program.status = Status.ACTIVE
                org1Programs.push(program)
            }

            for (let i = programsCount / 2; i < programsCount; i++) {
                const program = createProgram(org2)
                program.name = `program ${i}`
                program.status = Status.INACTIVE
                org2Programs.push(program)
            }

            programs.push(...org1Programs, ...org2Programs)

            await connection.manager.save(programs)

            school.programs = Promise.resolve([org1Programs[0]])
            await connection.manager.save(school)
        })

        context('admin', () => {
            beforeEach(async () => {
                // Make the User an admin
                user.email = ADMIN_EMAIL
                await user.save()
            })
            it('can view Programs from other Organizations', async () => {
                const adminToken = generateToken(userToPayload(user))
                for (const u of users) {
                    const programNodeResponse = await programNode(
                        testClient,
                        { authorization: adminToken },
                        org2Programs[0].id
                    )

                    expect(programNodeResponse).to.exist
                }
            })
        })

        context('non-admin', () => {
            it('can view custom Programs from the Organizations they belong', async () => {
                const userToken = generateToken(userToPayload(user))
                const programNodeResponse = await programNode(
                    testClient,
                    { authorization: userToken },
                    org1Programs[1].id
                )
                expect(programNodeResponse.name).to.equal(org1Programs[1].name)
            })
        })
    })
})
