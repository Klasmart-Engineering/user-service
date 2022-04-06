import { expect } from 'chai'
import { permissionInfo } from '../../../src/permissions/permissionInfo'

it('has a category, group, level and description assigned to all permissions', async () => {
    const info = await permissionInfo()

    const missingData = Array.from(info).filter(([name, details]) => {
        return (
            // Undefined permissions aren't currently in use
            !name.startsWith('undefine') &&
            !(
                details.category &&
                details.group &&
                details.level &&
                details.description
            )
        )
    })

    expect(missingData).to.deep.equal([])
})
