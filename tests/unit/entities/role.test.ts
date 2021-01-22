import { expect } from "chai";
import { Connection } from "typeorm";

import { createTestConnection } from "../../utils/testConnection";
import { createRole } from "../../factories/role.factory";
import { Role } from "../../../src/entities/role";

describe("Role", () => {
    let connection: Connection;
    let manager : any;
    let role : Role;

    before(async () => {
        connection = await createTestConnection();
        manager = connection.manager
    });

    after(async () => {
        await connection?.close();
    });

    beforeEach(async () => {
        await connection.synchronize(true);
        role = createRole();
    });

    describe(".new", () => {
        context("when all details are correct", () => {
            beforeEach(async () => {
                await manager.save(role);
            });

            it("creates the role", async () => {
                const dbRole = await Role.findOneOrFail(role.role_id)

                expect(dbRole.role_id).to.eq(role.role_id)
                expect(dbRole.role_name).to.eq(role.role_name)
                expect(dbRole.role_description).to.eq(role.role_description)
            });
        });
    });
});


