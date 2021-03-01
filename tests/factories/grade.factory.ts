import faker from "faker";

import { AgeRange } from "../../src/entities/ageRange";
import { createOrganization } from "./organization.factory";
import { Grade } from "../../src/entities/grade";
import { Organization } from "../../src/entities/organization";

export function createGrade(org: Organization = createOrganization(), ageRange?: AgeRange, progressFromGrade?: Grade, progressToGrade?: Grade) {
    const grade = new Grade();

    grade.name = faker.random.word();
    grade.organization = Promise.resolve(org)
    grade.system = false

    if(ageRange) {
        grade.age_range = Promise.resolve(ageRange)
    }

    if (progressFromGrade) {
        grade.progress_from_grade = Promise.resolve(progressFromGrade)
    }

    if (progressToGrade) {
        grade.progress_to_grade = Promise.resolve(progressToGrade)
    }

    return grade;
}
