import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { User } from "../../src/entities/user";
import { createOrganization } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/testEntities";
import { getSchoolMembershipsForOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganization, createSchool, createRole } from "../utils/operations/organizationOps";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { SchoolMembership } from "../../src/entities/schoolMembership";
import { JoeAuthToken } from "../utils/testConfig";
import { Organization } from "../../src/entities/organization";
import { Role } from "../../src/entities/role";

describe("organization", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let user: User;
    let organization: Organization;
    let role: Role;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    after(async () => {
        await connection?.close();
    });

    function reloadDatabase() {
        return connection?.synchronize(true);
    }

    describe("findOrCreateUser", async () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
            organization = await createOrganization(testClient, user.user_id);
        });
        it("should assign the old user to the exsting user", async () => {
            let oldUser: User
            let email = user.email ?? ""
            oldUser = await organization["findOrCreateUser"](email, user.given_name, user.family_name)
            expect(oldUser).to.exist
            expect(oldUser.user_id).to.equal(user.user_id)    
            
        });
        it("should assign the new user to a new user", async () => {
            let newUser: User
            newUser = await organization["findOrCreateUser"]("bob@nowhere.com", "Bob", "Smith")
            expect(newUser).to.exist
            expect(newUser.email).to.equal("bob@nowhere.com")
        });

    });

    describe("membershipOrganization", async () => {
        context("we have a user and an organization", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            beforeEach(async () => {
                await reloadDatabase();
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganization(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
            })
            it("Should set the user as a member of the organization", async () => {
                let membership = await organization["membershipOrganization"](user, new Array(role))
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(userId)
            });

        });
    })

    describe("membershipSchools", async () => {
        context("when user is a member of an organization", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            beforeEach(async () => {
                await reloadDatabase();
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganization(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
                schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
                await addUserToOrganization(testClient, userId, organizationId, { authorization: JoeAuthToken });
            });

            it("should set the school in the schools membership for the user", async () => {

                let schoolmemberships: SchoolMembership[]
                let oldSchoolMemberships: SchoolMembership[]
                [schoolmemberships, oldSchoolMemberships] = await organization["membershipSchools"](user, new Array(schoolId), new Array(role))
                expect(oldSchoolMemberships).to.exist
                expect(oldSchoolMemberships).to.be.empty
                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(userId)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
            });
        });
    });

    describe("_setMembership", async () => {
        context("We have an email, given_name, family_name, organization_role_ids, school_ids and school_role_ids", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            let roleId: string
            beforeEach(async () => {
                await reloadDatabase();
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganization(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
                roleId = role.role_id
                schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
            });

            it("should create the user, make the user a member of the organization and set the school in the schools membership for the user", async () => {

                let object = await organization["_setMembership"]("bob@nowhere.com", "Bob", "Smith", new Array(roleId), Array(schoolId), new Array(roleId))

                let newUser = object.user
                let membership = object.membership
                let schoolmemberships = object.schoolMemberships

                expect(newUser).to.exist
                expect(newUser.email).to.equal("bob@nowhere.com")

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
                
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)

            });
            it("should find the user, make the user a member of the organization and set the school in the schools membership for the user", async () => {
                let email = user.email ?? "anyone@email.com"
                let given = user.given_name ?? "anyone"
                let family = user.family_name ?? "at_all"
                let object = await organization["_setMembership"](email, given, family, new Array(roleId), Array(schoolId), new Array(roleId))

                let newUser = object.user
                let membership = object.membership
                let schoolmemberships = object.schoolMemberships

                expect(newUser).to.exist
                expect(newUser.user_id).to.equal(user.user_id)

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
                
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)

            });
        });
        context("We have an email, given_name, family_name, organization_role_ids, school_ids and school_role_ids and the user already is another school member", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            let oldSchoolId: string;
            let roleId: string
            beforeEach(async () => {
                await reloadDatabase();
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganization(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
                roleId = role.role_id
                oldSchoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
                schoolId = (await createSchool(testClient, organizationId, "school 2", { authorization: JoeAuthToken })).school_id;
                await addUserToSchool(testClient, userId, oldSchoolId, { authorization: JoeAuthToken });
            });
            it("should find the user, make the user a member of the organization and set the school in the schools membership for the user", async () => {
                let email = user.email ?? "anyone@email.com"
                let given = user.given_name ?? "anyone"
                let family = user.family_name ?? "at_all"
                let object = await organization["_setMembership"](email, given, family, new Array(roleId), Array(schoolId), new Array(roleId))

                let newUser = object.user
                let membership = object.membership
                let schoolmemberships = object.schoolMemberships

                expect(newUser).to.exist
                expect(newUser.user_id).to.equal(user.user_id)

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
                
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)

                const gqlSchoolMemberships = await getSchoolMembershipsForOrganizationMembership(testClient, userId, organizationId);
                expect(gqlSchoolMemberships).to.have.lengthOf(1);
                expect(gqlSchoolMemberships[0].school_id).to.equal(schoolId);

            });
        });

    });

});