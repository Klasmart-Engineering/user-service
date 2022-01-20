import faker from 'faker'
import { Category } from '../../src/entities/category'
import { createOrganization } from './organization.factory'
import { Organization } from '../../src/entities/organization'
import { Subcategory } from '../../src/entities/subcategory'

export function createCategory(
    org: Organization = createOrganization(),
    subcategories: Subcategory[] = [],
    system = false
) {
    const category = new Category()

    category.name = faker.random.word()
    category.organization = Promise.resolve(org)
    category.subcategories = Promise.resolve(subcategories)
    category.system = system

    return category
}

export const createCategories = (
    length: number,
    org?: Organization,
    subCats?: Subcategory[],
    system = false
) =>
    Array(length)
        .fill(undefined)
        .map(() => createCategory(org, subCats, system))
