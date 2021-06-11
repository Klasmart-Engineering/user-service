import { expect } from 'chai'
import { latestPermissions } from '../../utils/latestPermissions'
import { studentRole } from '../../../src/permissions/student'

describe('studentRole', () => {
    const { permissions } = studentRole

    it('contains all the expected permissions', async () => {
        const expectedPermissions = await latestPermissions()

        for (const [
            permissionCode,
            permissionInfo,
        ] of expectedPermissions.entries()) {
            if (permissionInfo.student) {
                expect(permissions).to.include(permissionCode)
            } else {
                expect(permissions).not.to.include(permissionCode)
            }
        }
    })
})
