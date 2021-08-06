import faker from 'faker'
import { Organization } from '../../src/entities/organization'
import { User } from '../../src/entities/user'
import { createUser } from './user.factory'
import { Status } from '../../src/entities/status'

export function createOrganization( { organization_name, status }: Partial<Organization>, user: User = createUser({}) ) {
    const organization = new Organization()

    organization.organization_name = organization_name || faker.name.findName()
    organization.owner = Promise.resolve( user )
    organization.status = status || Status.ACTIVE
    return organization
}
