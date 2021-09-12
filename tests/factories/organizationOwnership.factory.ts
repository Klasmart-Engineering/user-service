import { Organization } from '../../src/entities/organization'
import { OrganizationOwnership } from '../../src/entities/organizationOwnership'
import { User } from '../../src/entities/user'

export function createOrganizationOwnership({
    user,
    organization,
}: {
    user: User
    organization: Organization
}): OrganizationOwnership {
    const ownership = new OrganizationOwnership()
    ownership.organization = Promise.resolve(organization)
    ownership.user = Promise.resolve(user)
    return ownership
}
