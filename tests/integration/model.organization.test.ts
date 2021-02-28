import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Organization } from "../../src/entities/organization";
import { Role } from "../../src/entities/role";
import { createOrganizationAndValidate, userToPayload } from "../utils/operations/userOps";
import { createUserAndValidate} from "../utils/operations/modelOps";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { accountUUID, User } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { JoeAuthToken, BillyAuthToken, generateToken} from "../utils/testConfig";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { createRole, addUserToOrganizationAndValidate } from "../utils/operations/organizationOps";
import { PermissionName } from "../../src/permissions/permissionNames";
import { grantPermission } from "../utils/operations/roleOps";
import { OrganizationConnection } from "../../src/utils/pagingconnections";



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

const GET_V1_ORGANIZATIONS = `
    query myQuery($organization_ids:[ID!],$after:String,$before:String,$first:Int,$last:Int) {
        organizations_v1(organization_ids:$organization_ids,after:$after,before:$before,first:$first,last:$last) {
            total
            edges {
                organization_id
                organization_name
            }
            pageInfo{
                hasPreviousPage
                hasNextPage
                endCursor
                startCursor
            }
        }
    }
`;

const RESET_ORGANIZATION_ROLES_PERMISSIONS = `
    mutation resetOrganizationRolesPermissions($organization_id: ID!) {
        organization(organization_id: $organization_id) {
            resetDefaultRolesPermissions {
                role_id
                role_name
                permissions {
                    permission_name
                    role_id
                }
            }
        }
    }
`;

describe("model.organization", () => {
    let connection: Connection;
    let originalAdmins: string[];
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
        context("when none", () => {
            it("should return an empty array", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
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
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
            });

            it("should return an array containing one organization", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizations = res.data?.organizations as Organization[];
                expect(organizations).to.exist;
                expect(organizations).to.have.lengthOf(1);
            });
        });
    });

    describe("getOrganization", () => {
        context("when none", () => {
            it("should return null", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: accountUUID() },
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                expect(res.data?.organization).to.be.null;
            });
        });

        context("when one", () => {
            let organization: Organization;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                organization = await createOrganizationAndValidate(testClient, user.user_id);
            });

            it("should return an array containing one organization", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ORGANIZATION,
                    variables: { organization_id: organization.organization_id },
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlOrganization = res.data?.organization as Organization;
                expect(gqlOrganization).to.exist;
                expect(organization).to.include(gqlOrganization);
            });
        });
    });
    describe("getv1Organizations", () => {
        context("We have 9 organizations", () => {
            let user: User;
            const orgIds: string[] = []

            beforeEach(async () => {
                orgIds.length = 0
                await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                for (let i = 1; i < 10; i++) {
                    let anne1 = {
                        given_name: "Anne" + i,
                        family_name: "Bob",
                        email: "apollo" + i + "@calmid.com",
                        avatar: "anne_avatar"
                    } as User
                    anne1 = await createUserAndValidate(testClient, anne1)
                    const anne1Token = generateToken(userToPayload(anne1))
                    const organization1 = await createOrganizationAndValidate(testClient, anne1.user_id, "org " + i, anne1Token);
                    await addUserToOrganizationAndValidate(testClient, user.user_id, organization1.organization_id, { authorization: anne1Token });
                    if (i < 8) {
                        orgIds.push(organization1.organization_id)
                    }
                }
            });

            it("should get paged organizations as admin", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { first: 5 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                const total = organizationConn.total
                expect(total).to.equal(9)
                expect(organizationConn).to.exist;
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(5);
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasNextPage)


                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { after: pageInfo?.endCursor, first: 5 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                expect(organizationConn2.total).to.equal(total)
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(4);
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(!pageInfo2?.hasNextPage)

            });

            it("should get paged organizations as admin in reverse order", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { last: 5 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                const total = organizationConn.total
                expect(total).to.equal(9)
                expect(organizationConn).to.exist;
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(5);
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasPreviousPage)


                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { before: pageInfo?.startCursor, last: 5 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                expect(organizationConn2.total).to.equal(total)
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(4);
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(!pageInfo2?.hasPreviousPage)

            });


            it("should get paged organizations by ids as admin", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { organization_ids: orgIds, first: 5 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn).to.exist;
                const total = organizationConn.total
                expect(total).to.equal(orgIds.length)
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(5);
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasNextPage)


                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { organization_ids: orgIds, after: pageInfo?.endCursor, first: 5 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                expect(organizationConn2.total).to.equal(orgIds.length)
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(2);
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(pageInfo2.hasPreviousPage)
                expect(!pageInfo2?.hasNextPage)
                const res3 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { organization_ids: orgIds, before: pageInfo2?.startCursor, last: 5 }
                });
                expect(res3.errors, res3.errors?.toString()).to.be.undefined;
                const organizationConn3 = res3.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn3).to.exist;
                expect(organizationConn3.total).to.equal(orgIds.length)
                let organizations3 = organizationConn3.edges
                expect(organizations3).to.have.lengthOf(5);
                let pageInfo3 = organizationConn3.pageInfo
                expect(pageInfo3).to.exist
                expect(pageInfo3.hasPreviousPage)
                expect(pageInfo3?.hasNextPage)

            });

            it("should get paged organizations as user", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { first: 5 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn).to.exist;
                const total = organizationConn.total
                expect(total).to.equal(9)
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(5);
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasNextPage)


                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { after: pageInfo?.endCursor, first: 5 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(4);
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(!pageInfo2?.hasNextPage)

            });

            it("should get paged organizations as user in reverse order", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { last: 5 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn).to.exist;
                const total = organizationConn.total
                expect(total).to.equal(9)
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(5);
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasPreviousPage)


                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { before: pageInfo?.startCursor, last: 5 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(4);
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(!pageInfo2?.hasPreviousPage)

            });

            it("should get paged organizations by ids as user", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { organization_ids: orgIds, first: 5 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn).to.exist;
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(5);
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasNextPage)


                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { organization_ids: orgIds, after: pageInfo?.endCursor, first: 5 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(2);
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(!pageInfo2?.hasNextPage)

            });

        });
        context("We have only 2 organizations", () => {

            let user: User;
            const orgIds: string[] = []
            beforeEach(async () => {
                orgIds.length = 0
                await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                for (let i = 1; i < 3; i++) {
                    let anne1 = {
                        given_name: "Anne" + i,
                        family_name: "Bob",
                        email: "apollo" + i + "@calmid.com",
                        avatar: "anne_avatar"
                    } as User
                    anne1 = await createUserAndValidate(testClient, anne1)
                    const anne1Token = generateToken(userToPayload(anne1))
                    const organization1 = await createOrganizationAndValidate(testClient, anne1.user_id, "org " + i, anne1Token);
                    await addUserToOrganizationAndValidate(testClient, user.user_id, organization1.organization_id, { authorization: anne1Token });
                }
            });

            it("admin gets two diffent organizations (with name fields) from the front and back with a page size one", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { first: 1 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                const total = organizationConn.total
                expect(total).to.equal(2)
                expect(organizationConn).to.exist;
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(1);
                const firstId = organizations[0].organization_id
                const firstName = organizations[0].organization_name
                expect(firstName).to.exist
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasNextPage)
                expect(!pageInfo?.hasPreviousPage)


                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: JoeAuthToken },
                    variables: { last: 1 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                expect(organizationConn2.total).to.equal(total)
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(1);
                const lastId = organizations2[0].organization_id
                expect(lastId).to.not.equal(firstId)
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(!pageInfo2?.hasNextPage)
                expect(pageInfo2?.hasPreviousPage)

            });
            it("user gets two diffent organizations (with name fields) from the front and back with a page size one", async () => {
                const { query } = testClient;
                const res = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { first: 1 }
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const organizationConn = res.data?.organizations_v1 as OrganizationConnection;
                const total = organizationConn.total
                expect(total).to.equal(2)
                expect(organizationConn).to.exist;
                let organizations = organizationConn.edges
                expect(organizations).to.have.lengthOf(1);
                const firstId = organizations[0].organization_id
                const firstName = organizations[0].organization_name
                expect(firstName).to.exist
                let pageInfo = organizationConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasNextPage)
                expect(!pageInfo?.hasPreviousPage)



                const res2 = await query({
                    query: GET_V1_ORGANIZATIONS,
                    headers: { authorization: BillyAuthToken },
                    variables: { last: 1 }
                });

                expect(res2.errors, res2.errors?.toString()).to.be.undefined;
                const organizationConn2 = res2.data?.organizations_v1 as OrganizationConnection;
                expect(organizationConn2).to.exist;
                expect(organizationConn2.total).to.equal(total)
                let organizations2 = organizationConn2.edges
                expect(organizations2).to.have.lengthOf(1);
                const lastId = organizations2[0].organization_id
                expect(lastId).to.not.equal(firstId)
                let pageInfo2 = organizationConn2.pageInfo
                expect(pageInfo2).to.exist
                expect(!pageInfo2?.hasNextPage)
                expect(pageInfo2?.hasPreviousPage)

            });
        });

    });
});
