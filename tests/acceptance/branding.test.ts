import chaiAsPromised from 'chai-as-promised'
import fs from 'fs'
import path from 'path'
import supertest from 'supertest'
import { getConnection } from 'typeorm'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { TestConnection } from '../utils/testConnection'
import { generateToken, getAPIKeyAuth } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import { BrandingImageTag } from '../../src/types/graphQL/branding'
import { User } from '../../src/entities/user'
import { userToPayload } from '../utils/operations/userOps'
import { createOrg } from '../utils/operations/acceptance/acceptanceOps.test'

use(chaiAsPromised)

const url = 'http://localhost:8080/user'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const user2_id = '16046442-75b8-4da5-b3df-aa53a70a13a1'
const org2_name = 'my-org2'

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
const DELETE_BRANDING_IMAGE = `
    mutation deleteOrganizationBrandingImage($organizationId: ID!, $brandingImageTag: BrandingImageTag!) {
        deleteBrandingImage(
            organizationId: $organizationId
            type: $brandingImageTag
        ) 
    }
`

const DELETE_BRANDING_COLOR = `
    mutation deleteOrganizationBrandingColor($organizationId: ID!) {
        deleteBrandingColor(
            organizationId: $organizationId
        ) 
    }
`

async function getOrg(orgId: string, token: string) {
    return await request
        .post('/graphql')
        .set({
            ContentType: 'application/json',
            Authorization: token,
        })
        .send({
            query: GET_ORGANIZATION,
            variables: {
                organizationId: orgId,
            },
        })
}

async function setBranding(
    orgId: string,
    primaryColor: string,
    imagePath: string,
    token: string
) {
    const imageData = fs.readFileSync(imagePath)
    const imageBuffer = Buffer.from(imageData)
    return await request
        .post('/graphql')
        .set({
            Authorization: token,
        })
        .field(
            'operations',
            JSON.stringify({
                query: SET_BRANDING,
                variables: {
                    organizationId: orgId,
                    primaryColor: primaryColor,
                },
            })
        )
        .field('map', JSON.stringify({ image: ['variables.organizationLogo'] }))
        .attach('image', imageBuffer, imagePath)
}

describe('acceptance.branding', () => {
    const primaryColor = '#cd657b'
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        await loadFixtures('users', connection)
    })

    it('sets branding successfully', async () => {
        const organization_id = ''

        // create organization
        const createOrgResponse = await createOrg(user_id, org_name)

        expect(createOrgResponse.status).to.eq(200)

        const createOrgData =
            createOrgResponse.body.data.user.createOrganization
        const orgId = createOrgData.organization_id
        expect(orgId).to.exist
        expect(createOrgData.organization_name).to.eq(org_name)

        // set branding
        const imagePath = path.resolve(
            path.dirname(__filename),
            '..',
            'fixtures/icon.png'
        )

        const setBrandingResponse = await setBranding(
            orgId,
            primaryColor,
            imagePath,
            getAPIKeyAuth()
        )

        expect(setBrandingResponse.status).to.eq(200)

        const setBrandingData = await setBrandingResponse.body.data.setBranding
        expect(setBrandingData.primaryColor).to.eq(primaryColor)
        expect(setBrandingData.iconImageURL).to.exist

        // get organization
        const getOrgResponse = await getOrg(orgId, getAPIKeyAuth())

        expect(getOrgResponse.status).to.eq(200)
        expect(getOrgResponse.body.errors).to.not.exist

        const getOrgData = getOrgResponse.body.data.organization
        expect(getOrgData).to.exist
        expect(getOrgData.organization_id).to.eq(orgId)
        const brandingData = getOrgData.branding
        expect(brandingData.primaryColor).to.equal(primaryColor)
    })

    it('deletes branding image successfully', async () => {
        const organization_id = ''

        const user2 = await connection
            .getRepository(User)
            .findOneByOrFail({ user_id: user2_id })
        const token = generateToken(userToPayload(user2))
        // create organization
        const createOrgResponse = await createOrg(user2_id, org_name)

        expect(createOrgResponse.status).to.eq(200)

        const createOrgData =
            createOrgResponse.body.data.user.createOrganization
        const orgId = createOrgData.organization_id
        expect(orgId).to.exist
        expect(createOrgData.organization_name).to.eq(org_name)

        // set branding
        const imagePath = path.resolve(
            path.dirname(__filename),
            '..',
            'fixtures/icon.png'
        )
        const data = fs.readFileSync(imagePath)
        const buffer = Buffer.from(data)
        const setBrandingResponse = await setBranding(
            orgId,
            primaryColor,
            imagePath,
            token
        )

        expect(setBrandingResponse.status).to.eq(200)

        const setBrandingData = setBrandingResponse.body.data.setBranding
        expect(setBrandingData.primaryColor).to.eq(primaryColor)
        expect(setBrandingData.iconImageURL).to.exist

        // get organization
        const getOrgResponse = await getOrg(orgId, token)

        expect(getOrgResponse.status).to.eq(200)
        const getOrgData = getOrgResponse.body.data.organization
        const brandingData = await getOrgData.branding
        expect(brandingData.iconImageURL).to.exist

        const setDeleteBrandingImageResponse = await request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: token,
            })
            .send({
                query: DELETE_BRANDING_IMAGE,
                variables: {
                    organizationId: orgId,
                    brandingImageTag: BrandingImageTag.ICON,
                },
            })

        expect(setDeleteBrandingImageResponse.status).to.eq(200)
        expect(setDeleteBrandingImageResponse.body.errors).to.not.exist

        const getOrgResponse2 = await getOrg(orgId, token)

        expect(getOrgResponse2.status).to.eq(200)
        expect(getOrgResponse2.body.errors).to.not.exist

        const getOrgData2 = getOrgResponse2.body.data.organization
        expect(getOrgData2).to.exist
        expect(getOrgData2.organization_id).to.eq(orgId)

        const brandingData2 = await getOrgData2.branding
        expect(brandingData2.primaryColor).to.equal(primaryColor)
        expect(brandingData2.iconImageURL).to.not.exist
    })

    it('deletes branding color successfully', async () => {
        const organization_id = ''

        const user2 = await connection
            .getRepository(User)
            .findOneByOrFail({ user_id: user2_id })
        const token = generateToken(userToPayload(user2))
        // create organization
        const createOrgResponse = await createOrg(user2_id, org_name)

        expect(createOrgResponse.status).to.eq(200)

        const createOrgData =
            createOrgResponse.body.data.user.createOrganization
        const orgId = createOrgData.organization_id
        expect(orgId).to.exist
        expect(createOrgData.organization_name).to.eq(org_name)

        // set branding
        const imagePath = path.resolve(
            path.dirname(__filename),
            '..',
            'fixtures/icon.png'
        )

        const setBrandingResponse = await setBranding(
            orgId,
            primaryColor,
            imagePath,
            token
        )

        expect(setBrandingResponse.status).to.eq(200)

        const setBrandingData = setBrandingResponse.body.data.setBranding
        expect(setBrandingData.primaryColor).to.eq(primaryColor)

        // get organization

        const getOrgResponse = await getOrg(orgId, token)

        expect(getOrgResponse.status).to.eq(200)
        const getOrgData = getOrgResponse.body.data.organization
        const brandingData = await getOrgData.branding
        expect(brandingData.primaryColor).to.equal(primaryColor)
        expect(brandingData.iconImageURL).to.exist

        const setDeleteBrandingColorResponse = await request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: token,
            })
            .send({
                query: DELETE_BRANDING_COLOR,
                variables: {
                    organizationId: orgId,
                },
            })
        expect(setDeleteBrandingColorResponse.status).to.eq(200)
        expect(setDeleteBrandingColorResponse.body.errors).to.not.exist

        const getOrgResponse2 = await getOrg(orgId, token)

        expect(getOrgResponse2.status).to.eq(200)
        expect(getOrgResponse2.body.errors).to.not.exist

        const getOrgData2 = getOrgResponse2.body.data.organization
        expect(getOrgData2).to.exist
        expect(getOrgData2.organization_id).to.eq(orgId)

        const brandingData2 = await getOrgData2.branding
        expect(brandingData2.primaryColor).to.equal(null)
        expect(brandingData2.iconImageURL).to.exist
    })
})
