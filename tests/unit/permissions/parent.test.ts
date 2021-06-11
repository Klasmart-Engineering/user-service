import { expect } from 'chai'
import { latestPermissions } from '../../utils/latestPermissions'
import { parentRole } from '../../../src/permissions/parent'

describe('parentRole', () => {
    const { permissions } = parentRole

    it('contains all the expected permissions', async () => {
        const expectedPermissions = await latestPermissions()

        for (const [
            permissionCode,
            permissionInfo,
        ] of expectedPermissions.entries()) {
            if (permissionInfo.parent) {
                expect(permissions).to.include(permissionCode)
            } else {
                expect(permissions).not.to.include(permissionCode)
            }
        }
    })
})
