import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createUser } from '../factories/user.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { userToPayload } from './operations/userOps'

export const createInitialData = async (permissionNames: PermissionName[]) => {
    const clientUser = await createUser().save()
    const organization = await createOrganization().save()
    const role = await createRole(undefined, organization, {
        permissions: permissionNames,
    }).save()

    await createOrganizationMembership({
        user: clientUser,
        organization: organization,
        roles: [role],
    }).save()

    const permissions = new UserPermissions(userToPayload(clientUser))
    const context = { permissions }

    return { organization, context, user: clientUser }
}
