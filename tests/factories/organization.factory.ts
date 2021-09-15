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

export const createOrganizations = (length: number) =>
    Array(length).fill(undefined).map(createOrganization)
