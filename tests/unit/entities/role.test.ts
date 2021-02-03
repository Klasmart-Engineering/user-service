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
        context("when system_role is not defined", () => {
            beforeEach(async () => {
                role.system_role = undefined;
                await manager.save(role);
            });

            it("creates the role as not a system role", async () => {
                const dbRole = await Role.findOneOrFail(role.role_id)

                expect(dbRole.role_id).to.eq(role.role_id)
                expect(dbRole.role_name).to.eq(role.role_name)
                expect(dbRole.system_role).to.be.false
            });
        });

        context("when role description is undefined", () => {
            beforeEach(async () => {
                role.role_description = undefined;
                await manager.save(role);
            });

            it("creates the role with the default description", async () => {
                const dbRole = await Role.findOneOrFail(role.role_id)

                expect(dbRole.role_id).to.eq(role.role_id)
                expect(dbRole.role_name).to.eq(role.role_name)
                expect(dbRole.role_description).to.eq('System Default Role')
            });
        });

        context("when all details are correct", () => {
            beforeEach(async () => {
                await manager.save(role);
            });

            it("creates the role", async () => {
                const dbRole = await Role.findOneOrFail(role.role_id)

                expect(dbRole.role_id).to.eq(role.role_id)
                expect(dbRole.role_name).to.eq(role.role_name)
                expect(dbRole.role_description).to.eq(role.role_description)
                expect(dbRole.system_role).to.eq(role.system_role)
            });
        });
    });
});


