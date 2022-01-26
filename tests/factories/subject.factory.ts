import faker from 'faker'
import { Category } from '../../src/entities/category'
import { createOrganization } from './organization.factory'
import { Organization } from '../../src/entities/organization'
import { Subject } from '../../src/entities/subject'

export function createSubject(
    org: Organization = createOrganization(),
    categories: Category[] = [],
    system = false
) {
    const subject = new Subject()
    subject.name = faker.random.word()

    if (!system) {
        subject.organization = Promise.resolve(org)
    }

    subject.categories = Promise.resolve(categories)
    subject.system = system

    return subject
}

export function createSubjects(
    length: number,
    org?: Organization,
    categories?: Category[],
    system?: boolean
) {
    return Array(length)
        .fill(undefined)
        .map(() => createSubject(org, categories, system))
}
