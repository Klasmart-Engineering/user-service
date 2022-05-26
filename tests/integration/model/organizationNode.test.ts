import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { gql } from 'graphql-tag'
import { before } from 'mocha'
import { SelectQueryBuilder, getConnection } from 'typeorm'
import { nonAdminOrganizationScope } from '../../../src/directives/isAdmin'
import { Branding } from '../../../src/entities/branding'
import { Organization } from '../../../src/entities/organization'
import { User } from '../../../src/entities/user'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { OrganizationConnectionNode } from '../../../src/types/graphQL/organization'
import { createServer } from '../../../src/utils/createServer'
import { createBranding } from '../../factories/branding.factory'
import { createBrandingImage } from '../../factories/brandingImage.factory'
import { createAdminUser, createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { gqlTry } from '../../utils/gqlTry'
import { ORGANIZATION_NODE_CORE_FIELDS } from '../../utils/operations/modelOps'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../../utils/operations/userOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { print } from 'graphql'
import { Headers } from 'node-mocks-http'
import { BrandingResult } from '../../../src/types/graphQL/branding'
import { BrandingImage } from '../../../src/entities/brandingImage'
import { OrganizationMembership } from '../../../src/entities/organizationMembership'

use(chaiAsPromised)

const ORGANIZATION_NODE_QUERY_2_NODES = gql`
    ${ORGANIZATION_NODE_CORE_FIELDS}

    query($id: ID!, $id2: ID!) {
        org1: organizationNode(id: $id) {
            ...organizationNodeCoreFields
        }
        org2: organizationNode(id: $id2) {
            ...organizationNodeCoreFields
        }
    }
`

async function organization2Nodes(
    testClient: ApolloServerTestClient,
    headers: Headers,
    id: string,
    id2: string
) {
    const { query } = testClient
    const operation = () =>
        query({
            query: print(ORGANIZATION_NODE_QUERY_2_NODES),
            variables: {
                id,
                id2,
            },
            headers,
        })

    await gqlTry(operation)
}

describe('organizationNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let user1: User
    let user2: User
    let org1: Organization
    let org2: Organization
    let branding1: Branding
    let branding2: Branding
    let scope: SelectQueryBuilder<Organization>
    let adminPermissions: UserPermissions

    // emulated ctx object to could test resolver
    let ctx: Context

    const buildScopeAndContext = async (permissions: UserPermissions) => {
        const scopeObject = Organization.createQueryBuilder('Organization')

        if (!permissions.isAdmin) {
            await nonAdminOrganizationScope(
                scope as SelectQueryBuilder<
                    Organization | OrganizationMembership
                >,
                permissions
            )
        }
        const ctxObject = ({
            permissions,
            loaders: createContextLazyLoaders(permissions),
        } as unknown) as Context

        return { scope: scopeObject, ctx: ctxObject }
    }

    const getOrganizationNode = async (organizationId: string) => {
        const coreResult = (await ctx.loaders.organizationNode.node.instance.load(
            {
                scope,
                id: organizationId,
            }
        )) as OrganizationConnectionNode

        const ownersResult = await ctx.loaders.organizationsConnection.owners.instance.load(
            organizationId
        )

        const brandingResult = (await ctx.loaders.organization.branding.instance.load(
            organizationId
        )) as BrandingResult

        return {
            coreResult,
            ownersResult,
            brandingResult,
        }
    }

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        admin = await createAdminUser().save()
        user1 = await createUser().save()
        user2 = await createUser().save()

        org1 = await createOrganizationAndValidate(
            testClient,
            user1.user_id,
            'Organization One',
            '0R60N3',
            getAdminAuthToken()
        )

        org1.address1 = 'Street One #1'
        org1.address2 = 'Street Two #1'
        org1.phone = '+521111111111'
        await org1.save()

        org2 = await createOrganizationAndValidate(
            testClient,
            user2.user_id,
            'Organization Two',
            '0R67W0',
            getAdminAuthToken()
        )

        org2.address1 = 'Street One #2'
        org2.address2 = 'Street Two #2'
        org2.phone = '+522222222222'
        await org2.save()

        const brandingImage1 = await createBrandingImage().save()
        branding1 = createBranding(org1)
        branding1.primaryColor = '#118ab2'
        branding1.images = [brandingImage1]
        await branding1.save()

        const brandingImage2 = await createBrandingImage().save()
        branding2 = createBranding(org2)
        branding2.primaryColor = '#f94144'
        branding2.images = [brandingImage2]
        await branding2.save()

        adminPermissions = new UserPermissions(userToPayload(admin))

        // Emulating context
        const result = await buildScopeAndContext(adminPermissions)
        scope = result.scope
        ctx = result.ctx
    })

    context('data', () => {
        it('should get the correct organization with its correct data', async () => {
            const orgToTest = org1
            const {
                coreResult,
                ownersResult,
                brandingResult,
            } = await getOrganizationNode(orgToTest.organization_id)

            expect(coreResult).to.exist
            expect(coreResult).to.be.an('object')
            expect(coreResult.id).to.eq(orgToTest.organization_id)
            expect(coreResult.name).to.eq(orgToTest.organization_name)
            expect(coreResult.shortCode).to.eq(orgToTest.shortCode)
            expect(coreResult.status).to.eq(orgToTest.status)
            expect(coreResult.contactInfo.address1).to.eq(orgToTest.address1)
            expect(coreResult.contactInfo.address2).to.eq(orgToTest.address2)
            expect(coreResult.contactInfo.phone).to.eq(orgToTest.phone)

            const ownersToCompare = [(await orgToTest.owner) as User]
            expect(ownersResult).to.exist
            expect(ownersResult).to.be.an('array')
            expect(ownersResult?.length).to.eq(1)
            expect(ownersResult.length).to.eq(ownersToCompare.length)
            ownersToCompare.forEach((o) => {
                expect(ownersResult.find((or) => o.user_id === or.id)).to.exist
            })

            expect(brandingResult).to.exist
            expect(brandingResult).to.be.an('object')
            expect(brandingResult.primaryColor).to.eq(branding1.primaryColor)
            expect(brandingResult.iconImageURL).to.eq(
                ((await branding1.images) as BrandingImage[])[0].url
            )
        })
    })

    context('database calls', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await organization2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                org1.organization_id,
                org2.organization_id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('input error handling', () => {
        it("throws an error if id doesn't exist", async () => {
            await expect(
                ctx.loaders.organizationNode.node.instance.load({
                    scope,
                    id: '00000000-0000-0000-0000-00000',
                })
            ).to.be.rejected
        })
    })
})
