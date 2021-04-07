import faker from "faker";

import { createOrganization } from "./organization.factory";
import { Organization } from "../../src/entities/organization";
import { Role } from "../../src/entities/role";

export function createRole(role_name: string = faker.random.word(), org?: Organization) {
    const role = new Role();

    role.role_name = role_name;
    if(org){
        role.organization = Promise.resolve(org)
    }
    role.role_description = faker.random.words();
    role.system_role = false

    return role;
}
