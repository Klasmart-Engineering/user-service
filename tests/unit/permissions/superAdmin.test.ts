import { expect } from 'chai'
import { latestPermissions } from '../../utils/latestPermissions'
import { superAdminRole } from '../../../src/permissions/superAdmin'

describe('superAdmintRole', () => {
    const { permissions } = superAdminRole

    it('contains all the expected permissions', async () => {
        const expectedPermissions = await latestPermissions()

        for (const [
            permissionCode,
            permissionInfo,
        ] of expectedPermissions.entries()) {
            if (permissionInfo.superAdmin) {
                expect(permissions).to.include(permissionCode)
            } else {
                expect(permissions).not.to.include(permissionCode)
            }
        }
    })
})
