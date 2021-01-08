import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Role } from "../../src/entities/role";
import { createRole } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/testEntities";
import { v4 as uuidv4} from "uuid";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";

const GET_ROLES = `
    query getRoles {
        roles {
            role_id
            role_name
        }
    }
`;

const GET_ROLE = `
    query myQuery($role_id: ID!) {
        role(role_id: $role_id) {
            role_id
            role_name
        }
    }
`;

describe("model.role", () => {
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

    describe("getRoles", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });
    
        context("when none", () => {
            it("should return an empty array", async () => {
                const { query } = testClient;
        
                const res = await query({
                    query: GET_ROLES,
                });
        
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.be.empty;
            });
        });

        context("when one", () => {
            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                await createRole(testClient, organization.organization_id);
            });

            it("should return an array containing the default roles", async () => {
                const { query } = testClient;
        
                const res = await query({
                    query: GET_ROLES,
                });

                const dbRoles = await Role.find();
        
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const roles = res.data?.roles as Role[];
                expect(roles).to.exist;
                expect(roles).to.have.lengthOf(dbRoles.length);
            });
        });
    });

    describe("getRole", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });
    
        context("when none", () => {
            it("should return null", async () => {
                const { query } = testClient;
        
                const res = await query({
                    query: GET_ROLE,
                    variables: { role_id: uuidv4() },
                });
        
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                expect(res.data?.role).to.be.null;
            });
        });

        context("when one", () => {
            let role: Role;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                role = await createRole(testClient, organization.organization_id);
            });

            it("should return an array containing the default roles", async () => {
                const { query } = testClient;
        
                const res = await query({
                    query: GET_ROLE,
                    variables: { role_id: role.role_id },
                });
        
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlRole = res.data?.role as Role;
                expect(gqlRole).to.exist;
                expect(role).to.include(gqlRole);
            });
        });
    });
});