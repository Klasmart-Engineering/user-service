import faker from "faker";
import { Role } from "../../src/entities/role";

export function createRole() {
    const role = new Role();

    role.role_name = faker.random.word();
    role.role_description = faker.random.words();
    role.system_role = faker.random.boolean();

    return role;
}
