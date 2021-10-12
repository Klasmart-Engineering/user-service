import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Branding } from '../../../src/entities/branding'
import { BrandingImage } from '../../../src/entities/brandingImage'
import { Organization } from '../../../src/entities/organization'
import { Role } from '../../../src/entities/role'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { CoreOrganizationConnectionNode } from '../../../src/pagination/organizationsConnection'
import { BrandingResult } from '../../../src/types/graphQL/branding'
import { UserSummaryNode } from '../../../src/types/graphQL/userSummaryNode'
import { createServer } from '../../../src/utils/createServer'
import { createBranding } from '../../factories/branding.factory'
import { createBrandingImage } from '../../factories/brandingImage.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createUser } from '../../factories/user.factory'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { organizationNode } from '../../utils/operations/modelOps'
import {
    createOrganization,
    userToPayload,
} from '../../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

function expectCoreOrganizationConnectionEdge(
    queryResult: CoreOrganizationConnectionNode,
    organizationToCompare: Organization
) {
    expect(queryResult.id).to.eql(organizationToCompare.organization_id)
    expect(queryResult.name).to.eql(organizationToCompare.organization_name)
    expect(queryResult.status).to.eql(organizationToCompare.status)
    expect(queryResult.shortCode).to.eql(organizationToCompare.shortCode)
    expect(queryResult.contactInfo.phone).to.eql(organizationToCompare.phone)

    expect(queryResult.contactInfo.address1).to.eql(
        organizationToCompare.address1
    )

    expect(queryResult.contactInfo.address2).to.eql(
        organizationToCompare.address2
    )
}

function expectBrandingResult(
    brandingResult: BrandingResult,
    brandingToCompare: Branding
) {
    const images = brandingToCompare.images?.map((i) => i.url || '') || []

    expect(brandingResult.primaryColor).to.eql(brandingToCompare.primaryColor)
    expect([brandingResult.iconImageURL]).to.eql(images)
}

function expectUsersSummaryNode(
    queryUsers: UserSummaryNode[],
    usersToCompare: User[]
) {
    queryUsers.sort((a, b) => {
        if (a.id < b.id) {
            return -1
        }

        if (a.id > b.id) {
            return 1
        }

        return 0
    })

    usersToCompare.sort((a, b) => {
        if (a.user_id < b.user_id) {
            return -1
        }

        if (a.user_id > b.user_id) {
            return 1
        }

        return 0
    })

    queryUsers.forEach((qu, index) => {
        expect(qu.id).to.eql(usersToCompare[index].user_id)
    })
}

use(chaiAsPromised)

describe('organizationNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let orgOwner: User
    let nonAdmin: User
    let org1: Organization
    let org2: Organization
    let branding1: Branding
    let branding2: Branding

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        // Getting orgAdminRole
        const orgAdminRole = await Role.findOneOrFail({
            where: { role_name: 'Organization Admin', system_role: true },
        })

        // Creating Users
        admin = await createAdminUser(testClient)
        orgOwner = createUser()
        nonAdmin = createUser()
        await connection.manager.save([orgOwner, nonAdmin])

        // Creating Organizations
        org1 = await createOrganization(
            testClient,
            admin.user_id,
            'Organization One',
            '0R60N3',
            getAdminAuthToken()
        )

        org1.address1 = 'Street One 1'
        org1.address2 = 'Street Two 1'
        org1.phone = '1111111111'

        org2 = await createOrganization(
            testClient,
            orgOwner.user_id,
            'Organization Two',
            '0R67W0',
            getAdminAuthToken()
        )

        org2.address1 = 'Street One 2'
        org2.address2 = 'Street Two 2'
        org2.phone = '2222222222'

        await Organization.save([org1, org2])

        // Creating Branding Images
        const image1 = createBrandingImage()
        const image2 = createBrandingImage()

        await BrandingImage.save([image1, image2])

        // Creating Brandings
        branding1 = createBranding(org1)
        branding1.primaryColor = '#2a9d8f'
        branding1.images = [image1]

        branding2 = createBranding(org2)
        branding2.primaryColor = '#e76f51'
        branding2.images = [image2]

        await Branding.save([branding1, branding2])

        // adding admin to org1 with orgAdminRole
        await connection.manager.save(
            createOrganizationMembership({
                user: admin,
                organization: org1,
                roles: [orgAdminRole],
            })
        )

        // adding orgOwner to org2 with orgAdminRole
        await connection.manager.save(
            createOrganizationMembership({
                user: orgOwner,
                organization: org2,
                roles: [orgAdminRole],
            })
        )

        // adding nonAdmin to org2 with orgAdminRole
        await connection.manager.save(
            createOrganizationMembership({
                user: nonAdmin,
                organization: org2,
                roles: [],
            })
        )
    })

    context('data', () => {
        it('should get the correct organization with its coresponding data', async () => {
            const result = await organizationNode(
                testClient,
                org1.organization_id,
                {
                    authorization: getAdminAuthToken(),
                }
            )

            expect(result).to.be.an('object')
            expectCoreOrganizationConnectionEdge(result, org1)
            expectBrandingResult(result.branding, branding1)
            expectUsersSummaryNode(result.owners, [admin])
        })
    })

    context('permissions', () => {
        context('admin', () => {
            it('can access to its own organization', async () => {
                const token = generateToken(userToPayload(admin))
                const result = await organizationNode(
                    testClient,
                    org1.organization_id,
                    {
                        authorization: token,
                    }
                )

                expect(result).to.exist
            })

            it('can access to other organizations', async () => {
                const token = generateToken(userToPayload(admin))
                const result = await organizationNode(
                    testClient,
                    org2.organization_id,
                    {
                        authorization: token,
                    }
                )

                expect(result).to.exist
            })
        })

        context('organization admin', () => {
            it('can access to its own organization', async () => {
                const token = generateToken(userToPayload(orgOwner))
                const result = await organizationNode(
                    testClient,
                    org2.organization_id,
                    {
                        authorization: token,
                    }
                )

                expect(result).to.exist
            })
        })

        context('non admin', () => {
            it('can access to the organization which belongs', async () => {
                const token = generateToken(userToPayload(nonAdmin))

                const result = await organizationNode(
                    testClient,
                    org2.organization_id,
                    {
                        authorization: token,
                    }
                )

                expect(result).to.exist
            })
        })
    })

    context('error handling', () => {
        it('throws an error if id is not a ID', async () => {
            await expect(
                organizationNode(testClient, '1-4m-n0t-4n-1d', {
                    authorization: getAdminAuthToken(),
                })
            ).to.be.rejected
        })

        it("throws an error if id doesn't exist", async () => {
            await expect(
                organizationNode(testClient, '00000000-0000-0000-0000-00000', {
                    authorization: getAdminAuthToken(),
                })
            ).to.be.rejected
        })

        it("throws an error if an org admin tries to get an organization which doesn't owns", async () => {
            const token = generateToken(userToPayload(orgOwner))

            await expect(
                organizationNode(testClient, org1.organization_id, {
                    authorization: token,
                })
            ).to.be.rejected
        })

        it("throws an error if a non admin user tries to get an organization which doesn't belongs", async () => {
            const token = generateToken(userToPayload(nonAdmin))

            await expect(
                organizationNode(testClient, org1.organization_id, {
                    authorization: token,
                })
            ).to.be.rejected
        })
    })
})
