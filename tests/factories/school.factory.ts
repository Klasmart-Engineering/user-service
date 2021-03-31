import faker from "faker";
import { createOrganization } from "./organization.factory";
import { School } from "../../src/entities/school";
import { Status } from "../../src/entities/status";
import { Organization } from "../../src/entities/organization";
import { generateShortCode} from '../../src/utils/shortcode'

export function createSchool(org: Organization = createOrganization(), name?: string) {
    const school = new School();

    school.school_name = (!name) ?faker.random.word() : name;
    school.organization = Promise.resolve(org)
    school.shortcode = generateShortCode()
    school.status = Status.ACTIVE
    return school;
}
