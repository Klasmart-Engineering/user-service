import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { expect, use } from 'chai'
import { makeRequest } from './utils'
import { generateToken } from '../utils/testConfig'
import { createUser } from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { createRole } from '../factories/role.factory'
import { User } from '../../src/entities/user'

use(chaiAsPromised)

const url = 'http://localhost:8080/user'
const request = supertest(url)

describe('acceptance.authorization', () => {
    context('when user has a super admins email address', () => {
        let user: User

        beforeEach(async () => {
            user = await createUser({
                phone: '0800hacked',
                email: 'sandy@calmid.com',
            }).save()
        })

        context('but not a super admin email in their token', () => {
            let token: string

            beforeEach(() => {
                token = generateToken({
                    id: user.user_id,
                    phone: user.phone,
                    iss: 'calmid-debug',
                })
            })

            it('does not treat users as super admin for permissions check', async () => {
                // note that user is not part of org
                const org = await createOrganization().save()
                const newRole = await createRole(undefined, org).save()
                const oldRole = await createRole(undefined, org).save()

                const QUERY_THAT_CHECKS_PERMISSIONS = `mutation($newRoleId: ID!, $oldRoleId: ID!, $orgId: ID!) {
                    replaceRole(new_role_id: $newRoleId, old_role_id: $oldRoleId, organization_id: $orgId){
                        role_id
                    }
                }`

                const response = await makeRequest(
                    request,
                    QUERY_THAT_CHECKS_PERMISSIONS,
                    {
                        orgId: org.organization_id,
                        oldRoleId: newRole.role_id,
                        newRoleId: oldRole.role_id,
                    },
                    token
                )

                expect(response.body.errors).to.be.length(1)
                expect(response.body.errors[0].message).to.match(
                    /User\(.*\) does not have Permission\(edit_users_40330\) in Organizations\(.*\)/
                )
                expect(response.status).to.eq(200)
            })
        })
    })
})
