import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Role } from "../../src/entities/role";
import { addUserToOrganizationAndValidate, createRole, createSchool } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate, userToPayload } from "../utils/operations/userOps";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { accountUUID, User } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { JoeAuthToken, BillyAuthToken, generateToken } from "../utils/testConfig";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { createUserAndValidate } from "../utils/operations/modelOps";
import { OrganizationOwnership } from "../../src/entities/organizationOwnership";
import { RoleConnection } from "../../src/utils/pagingconnections";


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

const GET_V1_ROLES = `
    query myQuery($after:String,$before:String,$first:Int,$last:Int) {
        roles_v1(after:$after,before:$before,first:$first,last:$last) {
            total
            edges {
                role_id
                role_name
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

describe("model.role", () => {
    let connection: Connection;
    let originalAdmins: string[];
    let testClient: ApolloServerTestClient;
    let roleInfo = (role: Role) => { return role.role_id }

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    describe("getRoles", () => {
        context("when none", () => {
            it("returns only the system roles", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLES,
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const systemRoles = await Role.find({ where: { system_role: true } })

                const roles = res.data?.roles as Role[]
                expect(roles.map(roleInfo)).to.deep.eq(systemRoles.map(roleInfo))
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
        context("when none", () => {
            it("should return null", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_ROLE,
                    variables: { role_id: accountUUID() },
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
    describe("getv1Roles", () => {
        let user: User;
        const orgIds: string[] = []
        let connection: Connection;
        let originalAdmins: string[];


        beforeEach(async () => {
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
                const role1Id = (await createRole(testClient, organization1.organization_id, "role " + i, "1 role description", anne1Token)).role_id;
                await addRoleToOrganizationMembership(testClient, user.user_id, organization1.organization_id, role1Id, { authorization: anne1Token });
                const school1 = await createSchool(testClient, organization1.organization_id, "school " + i, undefined, { authorization: anne1Token })
                await addUserToSchool(testClient, user.user_id, school1.school_id, { authorization: anne1Token })
                await addRoleToSchoolMembership(testClient, user.user_id, school1.school_id, role1Id, { authorization: anne1Token })
            }
        });


        it("should get paged roles as admin!", async () => {
            let after: string | undefined = undefined
            for (let i = 1; i < 4; i++) {
                const { query } = testClient;
                let variables = { first: 5 } as any
                if (after) {
                    variables.after = after
                }
                const res = await query({
                    query: GET_V1_ROLES,
                    headers: { authorization: JoeAuthToken },
                    variables: variables
                });
                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const rolesConn = res.data?.roles_v1 as RoleConnection;
                expect(rolesConn).to.exist;
                expect(rolesConn.total).to.equal(14)
                let roles = rolesConn.edges
                const expectcount = i < 3 ? 5 : 4
                expect(roles).to.have.lengthOf(expectcount);
                let pageInfo = rolesConn.pageInfo
                expect(pageInfo).to.exist
                expect(pageInfo?.hasNextPage === i < 3)
                after = pageInfo?.endCursor
                if (i === 3) {
                    const before = pageInfo?.startCursor
                    variables = { last: 5 }
                    if (before) {
                        variables.before = before
                    }
                    const res1 = await query({
                        query: GET_V1_ROLES,
                        headers: { authorization: JoeAuthToken },
                        variables: variables
                    });
                    expect(res1.errors, res1.errors?.toString()).to.be.undefined;
                    const rolesConn1 = res1.data?.roles_v1 as RoleConnection;
                    expect(rolesConn1).to.exist;
                    expect(rolesConn1.total).to.equal(14)
                    roles = rolesConn1.edges
                    expect(roles).to.have.lengthOf(5);
                }
            }


        });


        it("should get paged roles as user", async () => {
            const { query } = testClient;
            const res = await query({
                query: GET_V1_ROLES,
                headers: { authorization: BillyAuthToken },
                variables: { first: 5 }
            });

            expect(res.errors, res.errors?.toString()).to.be.undefined;
            const rolesConn = res.data?.roles_v1 as RoleConnection;
            expect(rolesConn).to.exist;
            expect(rolesConn.total).to.equal(9)
            let roles = rolesConn.edges
            expect(roles).to.have.lengthOf(5);
            let pageInfo = rolesConn.pageInfo
            expect(pageInfo).to.exist
            expect(pageInfo?.hasNextPage)


            const res2 = await query({
                query: GET_V1_ROLES,
                headers: { authorization: BillyAuthToken },
                variables: { after: pageInfo?.endCursor, first: 5 }
            });

            expect(res2.errors, res2.errors?.toString()).to.be.undefined;
            const rolesConn2 = res2.data?.roles_v1 as RoleConnection;
            expect(rolesConn2).to.exist;
            expect(rolesConn2.total).to.equal(9)
            let roles2 = rolesConn2.edges
            expect(roles2).to.have.lengthOf(4);
            let pageInfo2 = rolesConn2.pageInfo
            expect(pageInfo2).to.exist
            expect(!pageInfo2?.hasNextPage)
            const before = pageInfo2?.startCursor
            const res3 = await query({
                query: GET_V1_ROLES,
                headers: { authorization: BillyAuthToken },
                variables: { before: pageInfo2?.startCursor, last: 5 }
            });
            expect(res2.errors, res3.errors?.toString()).to.be.undefined;
            const rolesConn3 = res3.data?.roles_v1 as RoleConnection;
            expect(rolesConn3).to.exist;
            expect(rolesConn3.total).to.equal(9)
            let roles3 = rolesConn3.edges
            expect(roles3).to.have.lengthOf(5);
            expect(roles3).deep.equal(roles)

        })
    });


});
