import { expect } from "chai";
import { Connection } from "typeorm";

import { createTestConnection } from "../../utils/testConnection";
import { createPermission } from "../../factories/permission.factory";
import { createRole } from "../../factories/role.factory";
import { Permission } from "../../../src/entities/permission";
import { Role } from "../../../src/entities/role";

describe("Permission", () => {
    let connection: Connection;
    let manager : any;
    let permission : Permission;
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
        permission = createPermission(role)
    });

    describe(".new", () => {
        context("when all details are correct", () => {
            beforeEach(async () => {
                await manager.save(role);
                await manager.save(permission);
            });

            it("creates the Permission", async () => {
                const dbPermission = await Permission.findOneOrFail({
                    where: {
                        permission_name: permission.permission_name
                    }
                })

                expect(dbPermission.permission_name).to.eq(permission.permission_name)
                expect(dbPermission.permission_id).to.eq(permission.permission_id)
                expect(dbPermission.allow).to.eq(permission.allow)
                expect(dbPermission.permission_category).to.eq(permission.permission_category)
                expect(dbPermission.permission_group).to.eq(permission.permission_group)
                expect(dbPermission.permission_level).to.eq(permission.permission_level)
                expect(dbPermission.permission_description).to.eq(permission.permission_description)
            });
        });
    });
});

