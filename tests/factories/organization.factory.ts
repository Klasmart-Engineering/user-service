import faker from 'faker'
import { Organization } from '../../src/entities/organization'
import { User } from '../../src/entities/user'
import { createUser } from './user.factory'

export function createOrganization(user: User = createUser()) {
    const organization = new Organization()

    organization.organization_name = faker.name.findName()
    organization.owner = Promise.resolve(user)

    return organization
}

export function createOrganizationPlus(args: Partial<Organization>) {
    const organization = new Organization()

    organization.organization_name =
        args.organization_name ?? faker.name.findName()
    organization.owner = args.owner
    organization.address1 = args.address1
    organization.address2 = args.address2
    organization.phone = args.phone
    organization.shortCode = args.shortCode
    organization.memberships = args.memberships

    return organization
}

export const createOrganizations = (length: number) =>
    Array(length).fill(undefined).map(createOrganization)
