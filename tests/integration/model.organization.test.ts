import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Organization } from "../../src/entities/organization";
import { createOrganization } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/operations/modelOps";
import { accountUUID } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { AuthToken } from "../utils/testConfig";

const GET_ORGANIZATIONS = `
    query getOrganizations {
        organizations {
            organization_id
            organization_name
        }
    }
`;

const GET_ORGANIZATION = `
    query myQuery($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            organization_id
            organization_name
        }
    }
`;

describe("model.organization", () => {
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

    describe("getOrganizations", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                const { query } = testClient;
    
                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: {
                        authorization: AuthToken,
                    },
                });
    
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizations = res.data?.organizations as Organization[];
                expect(organizations).to.exist;
                expect(organizations).to.be.empty;
            });
        });

        context("when one", () => {
            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganization(testClient, user.user_id);
            });

            it("should return an array containing one organization", async () => {
                const { query } = testClient;
    
                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: {
                        authorization: AuthToken,
                    },
                });
    
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizations = res.data?.organizations as Organization[];
                expect(organizations).to.exist;
                expect(organizations).to.have.lengthOf(1);
            });
        });
    });

    describe("getOrganization", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });
    
        context("when none", () => {
            it("should return null", async () => {
                const { query } = testClient;
        
                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: accountUUID() },
                    headers: {
                        authorization: AuthToken,
                    },
                });
        
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                expect(res.data?.organization).to.be.null;
            });
        });

        context("when one", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganization(testClient, user.user_id);
            });

            it("should return an array containing one organization", async () => {
                const { query } = testClient;
        
                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: organization.organization_id },
                    headers: {
                        authorization: AuthToken,
                    },
                });
        
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlOrganization = res.data?.organization as Organization;
                expect(gqlOrganization).to.exist;
                expect(organization).to.include(gqlOrganization);
            });
        });
    });
});
