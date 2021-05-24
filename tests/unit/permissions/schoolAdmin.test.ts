import { expect } from 'chai'
import { latestPermissions } from '../../utils/latestPermissions'
import { schoolAdminRole } from '../../../src/permissions/schoolAdmin'

describe('schoolAdminRole', () => {
    const { permissions } = schoolAdminRole

    it('contains all the expected permissions', async () => {
        const expectedPermissions = await latestPermissions()

        for (const [
            permissionCode,
            permissionInfo,
        ] of expectedPermissions.entries()) {
            if (permissionInfo.schoolAdmin) {
                expect(permissions).to.include(permissionCode)
            } else {
                expect(permissions).not.to.include(permissionCode)
            }
        }
    })
})
