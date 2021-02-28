import { Connection } from "typeorm";
import { expect } from "chai";

import { ApolloServerTestClient, createTestClient } from "../../utils/createTestClient";
import { createOrganizationAndValidate } from "../../utils/operations/userOps";
import { createTestConnection } from "../../utils/testConnection";
import { createServer } from "../../../src/utils/createServer";
import { createUserJoe } from "../../utils/testEntities";
import { Model } from "../../../src/model";
import { Organization } from "../../../src/entities/organization";
import RoleInitializer from '../../../src/initializers/roles'

describe("RolesInitializer", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    describe("run", () => {
        const roleInfoFunc =  function (role: any) {
            return { role_id: role.role_id, role_name: role.role_name }
        };
        const permissionInfoFunc =  function (permission: any) {
            return { permission_name: permission.permission_name }
        };

        context("when updated default permissions exists", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganizationAndValidate(testClient, user.user_id);
            });

            it("does not modify the default roles permissions", async () => {
                const { mutate } = testClient;
                const dbRoles = await organization.roles({}, {}, {}) || []
                let dbPermissions = []
                expect(dbRoles).not.to.be.empty;

                for(const role of dbRoles){
                    const permissions = await role.permissions || [];

                    expect(permissions).not.to.be.empty
                    dbPermissions.push(...permissions.map(permissionInfoFunc))
                }

                await RoleInitializer.run();

                organization = await Organization.findOneOrFail(organization.organization_id);
                const dbNewRoles = await organization.roles({}, {}, {}) || []
                expect(dbNewRoles).not.to.be.empty;

                expect(dbRoles.map(roleInfoFunc)).to.deep.equal(dbNewRoles?.map(roleInfoFunc));
                let resetPermissions = []

                for(const role of dbNewRoles){
                    const permissions = await role.permissions || [];

                    expect(permissions).not.to.be.empty
                    resetPermissions.push(...permissions?.map(permissionInfoFunc))
                }

                expect(dbPermissions).to.deep.members(resetPermissions)
            });
        });
    });
});
