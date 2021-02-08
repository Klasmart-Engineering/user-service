
import { expect, use } from "chai";
import { Connection } from "typeorm";
import { ApolloServerTestClient, createTestClient } from "../../utils/createTestClient";
import { createTestConnection } from "../../utils/testConnection";
import { createServer } from "../../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../../utils/testEntities";
import { JoeAuthToken, BillyAuthToken } from "../../utils/testConfig";
import { getAllOrganizations } from "../../utils/operations/modelOps";
import { createOrganizationAndValidate } from "../../utils/operations/userOps";
import { Model } from "../../../src/model";
import { User } from "../../../src/entities/user";
import { UserPermissions } from "../../../src/permissions/userPermissions";
import { Organization } from "../../../src/entities/organization";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

describe("isAdmin", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let originalAdmins: string[];

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);

        originalAdmins = UserPermissions.ADMIN_EMAILS
        UserPermissions.ADMIN_EMAILS = ['joe@gmail.com']
    });

    after(async () => {
        UserPermissions.ADMIN_EMAILS = originalAdmins
        await connection?.close();
    });

    beforeEach(async () => {
        await connection.synchronize(true);
    });

    describe("organizations", () => {
        let user: User;
        let organization: Organization;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
            organization = await createOrganizationAndValidate(testClient, user.user_id);
        });

        context("when user is not logged in", () => {
            it("returns an empty list of organizations", async () => {
                const gqlOrgs = await getAllOrganizations(testClient, { authorization: undefined });

                expect(gqlOrgs).to.be.empty;
            });
        });

        context("when user is logged in", () => {
            const orgInfo = (org: Organization) => { return org.organization_id }
            let otherOrganization: Organization

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
                otherOrganization = await createOrganizationAndValidate(testClient, otherUser.user_id, "Billy's Org");
            });

            context("and the user is an admin", () => {
                it("returns all the organizations", async () => {
                    const gqlOrgs = await getAllOrganizations(testClient, { authorization: JoeAuthToken });

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([
                        organization.organization_id,
                        otherOrganization.organization_id
                    ]);
                });
            });

            context("and the user is not an admin", () => {
                it("returns only the organizations it belongs to", async () => {
                    const gqlOrgs = await getAllOrganizations( testClient, { authorization: BillyAuthToken });

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([otherOrganization.organization_id]);
                });
            });
        });
    });
});
