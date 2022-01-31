import faker from 'faker'

import { createOrganization } from './organization.factory'
import { Grade } from '../../src/entities/grade'
import { Organization } from '../../src/entities/organization'

export function createGrade(
    org: Organization = createOrganization(),
    progressFromGrade?: Grade,
    progressToGrade?: Grade,
    system = false
) {
    const grade = new Grade()

    grade.name = faker.random.word()
    if (!system) grade.organization = Promise.resolve(org)
    grade.system = system

    if (progressFromGrade) {
        grade.progress_from_grade = Promise.resolve(progressFromGrade)
    }

    if (progressToGrade) {
        grade.progress_to_grade = Promise.resolve(progressToGrade)
    }

    return grade
}

export const createGrades = (
    length: number,
    org?: Organization,
    progressFromGrade?: Grade,
    progressToGrade?: Grade,
    system?: boolean
) =>
    Array(length)
        .fill(undefined)
        .map(() => createGrade(org, progressFromGrade, progressToGrade, system))
