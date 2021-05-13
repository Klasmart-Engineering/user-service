import faker from 'faker'
import { Subcategory } from '../../src/entities/subcategory'
import { createOrganization } from './organization.factory'
import { Organization } from '../../src/entities/organization'

export function createSubcategory(org: Organization = createOrganization()) {
    const subcategory = new Subcategory()

    subcategory.name = faker.random.word()
    subcategory.organization = Promise.resolve(org)
    subcategory.system = false

    return subcategory
}
