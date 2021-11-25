import { config } from '../../src/config/config'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Role } from '../../src/entities/role'
import { Status } from '../../src/entities/status'
import { User } from '../../src/entities/user'
import { generateShortCode } from '../../src/utils/shortcode'

export function createOrganizationMembership({
    user,
    organization,
    roles,
    status,
}: {
    user: User
    organization: Organization
    roles?: Role[]
    status?: Status
}): OrganizationMembership {
    const membership = new OrganizationMembership()
    membership.organization_id = organization.organization_id
    membership.organization = Promise.resolve(organization)
    membership.user_id = user.user_id
    membership.user = Promise.resolve(user)
    membership.shortcode = generateShortCode(
        user.user_id,
        config.limits.SHORTCODE_MAX_LENGTH
    )
    if (roles) {
        membership.roles = Promise.resolve(roles)
    }
    if (status) {
        membership.status = status
    }
    return membership
}
