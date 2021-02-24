import faker from "faker";
import { AgeRange } from "../../src/entities/ageRange";
import { AgeRangeUnit } from "../../src/entities/ageRangeUnit";
import { createOrganization } from "./organization.factory";
import { Organization } from "../../src/entities/organization";

export function createAgeRange(org: Organization = createOrganization()) {
    const ageRange = new AgeRange();

    ageRange.name = faker.random.word();
    ageRange.low_value = faker.random.number({ 'min': 0, 'max': 99 });
    ageRange.high_value = faker.random.number({ 'min': 1, 'max': 99 });
    ageRange.unit = faker.random.arrayElement(Object.values(AgeRangeUnit))
    ageRange.organization = Promise.resolve(org)
    ageRange.system = false

    return ageRange;
}

