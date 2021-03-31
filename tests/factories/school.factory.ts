import faker from "faker";
import { createOrganization } from "./organization.factory";
import { AgeRange } from "../../src/entities/ageRange";
import { Grade } from "../../src/entities/grade";
import { School } from "../../src/entities/school";
import { Status } from "../../src/entities/status";
import { Subject } from "../../src/entities/subject";
import { Organization } from "../../src/entities/organization";

export function createSchool(org: Organization = createOrganization(), name?: string) {
    const school = new School();

    school.school_name = (!name) ?faker.random.word() : name;
    school.organization = Promise.resolve(org)
    school.shortcode = faker.random.word()
    school.status = Status.ACTIVE
    return school;
}
