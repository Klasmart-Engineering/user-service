import { Connection } from "typeorm";

import AgeRangesInitializer from '../src/initializers/ageRanges'
import { ApolloServerTestClient } from "./utils/createTestClient";
import { createTestConnection } from "./utils/testConnection";
import RoleInitializer from '../src/initializers/roles'
import { UserPermissions } from "../src/permissions/userPermissions";

let connection: Connection
let testClient: ApolloServerTestClient
let originalAdmins: string[]

before(async () => {
    connection = await createTestConnection(false, "master")

    originalAdmins = UserPermissions.ADMIN_EMAILS
    UserPermissions.ADMIN_EMAILS = ['joe@gmail.com']
});

after(async () => {
    UserPermissions.ADMIN_EMAILS = originalAdmins
    await connection?.close()
});

beforeEach(async () => {
    await RoleInitializer.run()
    await AgeRangesInitializer.run()
});

afterEach(async () => {
    await connection.synchronize(true)
});
