import faker from 'faker'

import { createOrganization } from './organization.factory'
import { Grade } from '../../src/entities/grade'
import { Organization } from '../../src/entities/organization'

export function createGrade(
    org: Organization = createOrganization( {} ),
    progressFromGrade?: Grade,
    progressToGrade?: Grade
) {
    const grade = new Grade()

    grade.name = faker.random.word()
    grade.organization = Promise.resolve(org)
    grade.system = false

    if (progressFromGrade) {
        grade.progress_from_grade = Promise.resolve(progressFromGrade)
    }

    if (progressToGrade) {
        grade.progress_to_grade = Promise.resolve(progressToGrade)
    }

    return grade
}
