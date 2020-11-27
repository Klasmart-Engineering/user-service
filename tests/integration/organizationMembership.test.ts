import { expect } from "chai";
import { Connection } from "typeorm";
import { Class } from "../../src/entities/class";
import { Model } from "../../src/model";
import { createServer } from "../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { getSchoolMembershipsForOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganization, createSchool } from "../utils/operations/organizationOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { createOrganization } from "../utils/operations/userOps";
import { BillyAuthToken, JoeAuthToken } from "../utils/testConfig";
import { createTestConnection } from "../utils/testConnection";
import { createUserBilly, createUserJoe } from "../utils/testEntities";

describe("organizationMembership", () => {
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

    describe("schoolMemberships", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when user is a member of schools in different organizations", () => {
            let userId: string;
            let organization1Id: string;
            let organization2Id: string;
            let school1Id: string;
            let school2Id: string;

            beforeEach(async () => {
                const org1Owner = await createUserJoe(testClient);
                const org2Owner = await createUserBilly(testClient);
                userId = org1Owner.user_id;
                organization1Id = (await createOrganization(testClient, org1Owner.user_id, "org 1")).organization_id;
                organization2Id = (await createOrganization(testClient, org2Owner.user_id, "org 2", "second@email.net", "TESTA100", "1111444222")).organization_id;
                school1Id = (await createSchool(testClient, organization1Id, "school 1", { authorization: JoeAuthToken })).school_id;
                school2Id = (await createSchool(testClient, organization2Id, "school 2", { authorization: BillyAuthToken })).school_id;
                await addUserToOrganization(testClient, userId, organization1Id, { authorization: JoeAuthToken });
                await addUserToOrganization(testClient, userId, organization2Id, { authorization: BillyAuthToken });
                await addUserToSchool(testClient, userId, school1Id, { authorization: JoeAuthToken });
                await addUserToSchool(testClient, userId, school2Id, { authorization: BillyAuthToken });
            });

            it("should only return schools belonging to specified organization", async () => {
                const gqlSchoolMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, userId, organization1Id);
                expect(gqlSchoolMemberships).to.have.lengthOf(1);
                expect(gqlSchoolMemberships[0].school_id).to.equal(school1Id);
            });
        });
    });
});
