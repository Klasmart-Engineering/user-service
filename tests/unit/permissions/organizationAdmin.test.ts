import { expect } from 'chai'
import { latestPermissions } from '../../utils/latestPermissions'
import { organizationAdminRole } from '../../../src/permissions/organizationAdmin'

describe('organizationAdminRole', () => {
    const { permissions } = organizationAdminRole

    it('contains all the expected permissions', async () => {
        const expectedPermissions = await latestPermissions()

        for (const [
            permissionCode,
            permissionInfo,
        ] of expectedPermissions.entries()) {
            if (permissionInfo.orgAdmin) {
                expect(permissions).to.include(permissionCode)
            } else {
                expect(permissions).not.to.include(permissionCode)
            }
        }
    })
})
