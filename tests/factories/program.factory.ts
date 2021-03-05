import faker from "faker";

import { createOrganization } from "./organization.factory";
import { Program } from "../../src/entities/program";
import { Organization } from "../../src/entities/organization";

export function createProgram(org: Organization = createOrganization()) {
    const program = new Program();

    program.name = faker.random.word();
    program.organization = Promise.resolve(org)
    program.system = false

    return program;
}
