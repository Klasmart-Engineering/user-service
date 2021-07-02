import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { before } from 'mocha'

import { createTestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'

use(chaiAsPromised)

const url = 'http://localhost:8080'
const request = require('supertest')(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'

const GET_ORGANIZATION = `
    query myQuery($organization_id: ID!) {
        organization(organization_id: $organization_id) {
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
            createOrganization(organization_name: "my-org") {
                organization_id
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

    it('sets branding successfully', (done) => {
        let organization_id: string = ''

        // create organization
        request
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
            .expect(200)
            .end((err: any, res: any) => {
                if (err) return done(err)
                const data = res.body.data
                expect(data.organization).to.exist
                expect(data.organization.organization_id).to.exist

                organization_id = data.organization.organization_id
            })

        // set branding
        request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                operations: {
                    operationName: 'setOrganizationBranding',
                    query: SET_BRANDING,
                    variables: {
                        organizationId: organization_id,
                        iconImage: null,
                        primaryColor: primaryColor,
                    },
                },
                map: { '1': ['variables.organizationLogo'] },
                1: __dirname + '/../fixtures/icon.png',
            })
            .expect(200)
            .end((err: any, res: any) => {
                if (err) return done(err)
                const data = res.body.data
                expect(data.setBranding).to.exist
                expect(data.setBranding.iconImageURL).to.exist
                expect(data.setBranding.primaryColor).to.equal(primaryColor)
            })

        done()
    })

    it('gets organization with branding information successfully', (done) => {
        let organization_id: string = ''

        // create organization
        request
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
            .expect(200)
            .end((err: any, res: any) => {
                if (err) return done(err)
                const data = res.body.data
                expect(data.organization).to.exist
                expect(data.organization.organization_id).to.exist

                organization_id = data.organization.organization_id
            })

        // set branding
        request
            .post('/graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                operations: {
                    operationName: 'setOrganizationBranding',
                    query: SET_BRANDING,
                    variables: {
                        organizationId: organization_id,
                        iconImage: null,
                        primaryColor: primaryColor,
                    },
                },
                map: { '1': ['variables.organizationLogo'] },
                1: __dirname + '/../fixtures/icon.png',
            })
            .expect(200)
            .end((err: any, res: any) => {
                if (err) return done(err)
                const data = res.body.data
                expect(data.setBranding).to.exist
                expect(data.setBranding.iconImageURL).to.exist
                expect(data.setBranding.primaryColor).to.equal(primaryColor)
            })

        // get organization
        request
            .post('graphql')
            .set({
                ContentType: 'application/json',
                Authorization: getAdminAuthToken(),
            })
            .send({
                query: GET_ORGANIZATION,
                variables: {
                    organizationId: organization_id,
                },
            })
            .expect(200)
            .end((err: any, res: any) => {
                if (err) return done(err)
                const data = res.body.data
                expect(data.organization).to.exist
                expect(data.organization.iconImageURL).to.exist
                expect(data.organization.primaryColor).to.equal(primaryColor)
            })

        done()
    })
})
