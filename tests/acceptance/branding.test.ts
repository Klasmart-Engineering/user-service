import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { createTestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'

import supertest from 'supertest'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'

const GET_ORGANIZATION = `
    query myQuery($organizationId: ID!) {
        organization(organization_id: $organizationId) {
            organization_id
            organization_name
            branding {
                iconImageURL
                primaryColor
            }
        }
    }
`

const CREATE_ORGANIZATION = `
  mutation {
      user(user_id: "${user_id}") {
          createOrganization(organization_name: "${org_name}") {
              organization_id
              organization_name
          }
      }
  }
`

const SET_BRANDING = `
    mutation setOrganizationBranding($organizationId: ID!, $organizationLogo: Upload, $primaryColor: HexColor) {
        setBranding(
            organizationId: $organizationId
            iconImage: $organizationLogo
            primaryColor: $primaryColor
        ) {
            iconImageURL
            primaryColor
        }
    }
`

describe('acceptance.branding', () => {
    let connection: Connection
    const primaryColor = '#cd657b'
    before(async () => {
        connection = await createTestConnection()
        await loadFixtures('users', connection)
    })
    after(async () => {
        await connection?.close()
    })
    it('sets branding successfully', async () => {
        let organization_id: string = ''
        // create organization
        const createOrgResponse = await request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: CREATE_ORGANIZATION,
                variables: {
                    user_id,
                },
            })
        expect(createOrgResponse.status).to.eq(200)
        const orgId =
            createOrgResponse.body.data.user.createOrganization.organization_id
        expect(orgId).to.exist
        expect(
            createOrgResponse.body.data.user.createOrganization
                .organization_name
        ).to.eq(org_name)

        // set branding
        const setBrandingResponse = await request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                operationName: 'setOrganizationBranding',
                query: SET_BRANDING,
                variables: {
                    organizationId: orgId,
                    organizationLogo: null,
                    primaryColor: primaryColor,
                },
            })

        expect(setBrandingResponse.status).to.eq(200)
        expect(setBrandingResponse.body.data.setBranding).to.exist
        // expect(setBrandingResponse.body.data.setBranding.iconImageURL).to.exist
        expect(setBrandingResponse.body.data.setBranding.primaryColor).to.equal(
            primaryColor
        )
        expect(setBrandingResponse.body.errors).to.not.exist

        const getOrgResponse = await request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: GET_ORGANIZATION,
                variables: {
                    organizationId: orgId,
                },
            })

        expect(getOrgResponse.status).to.eq(200)
        expect(getOrgResponse.body.errors).to.not.exist
        expect(getOrgResponse.body.data.organization).to.exist
        expect(getOrgResponse.body.data.organization.organization_id).to.eq(
            orgId
        )
        expect(
            getOrgResponse.body.data.organization.branding.primaryColor
        ).to.equal(primaryColor)
    })
})
