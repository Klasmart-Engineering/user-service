import faker from "faker";
import { User } from "../../src/entities/user";

export function createUser() {
    const user = new User();

    user.given_name = faker.name.firstName();
    user.family_name = faker.name.lastName();
    user.email = faker.internet.email();

    return user;
}
