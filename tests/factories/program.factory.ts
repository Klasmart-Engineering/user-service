import faker from "faker";

import { createOrganization } from "./organization.factory";
import { AgeRange } from "../../src/entities/ageRange";
import { Grade } from "../../src/entities/grade";
import { Program } from "../../src/entities/program";
import { Subject } from "../../src/entities/subject";
import { Organization } from "../../src/entities/organization";

export function createProgram(org: Organization = createOrganization(), age_ranges: AgeRange[] = [] ,grades: Grade[] = [], subjects: Subject[] = []) {
    const program = new Program();

    program.name = faker.random.word();
    program.organization = Promise.resolve(org)
    program.age_ranges = Promise.resolve(age_ranges)
    program.grades = Promise.resolve(grades)
    program.subjects = Promise.resolve(subjects)
    program.system = false

    return program;
}
