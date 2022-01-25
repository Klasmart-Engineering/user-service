import faker from 'faker'
import { Category } from '../../src/entities/category'
import { createOrganization } from './organization.factory'
import { Organization } from '../../src/entities/organization'
import { Subcategory } from '../../src/entities/subcategory'
import { Subject } from '../../src/entities/subject'

export function createSubject(
    org: Organization = createOrganization(),
    categories: Category[] = []
) {
    const subject = new Subject()

    subject.name = faker.random.word()
    subject.organization = Promise.resolve(org)
    subject.categories = Promise.resolve(categories)
    subject.system = false

    return subject
}

function createSystemSubject(categories: Category[] = []) {
    const subject = new Subject()
    subject.name = faker.random.word()
    subject.categories = Promise.resolve(categories)
    subject.system = true
    return subject
}

export const createSystemSubjects = (length: number, categories?: Category[]) =>
    Array(length)
        .fill(undefined)
        .map(() => createSystemSubject(categories))
