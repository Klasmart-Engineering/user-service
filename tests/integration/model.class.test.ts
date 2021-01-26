import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Class } from "../../src/entities/class";
import { User } from "../../src/entities/user";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { accountUUID } from "../../src/entities/user";
import { addStudentToClass, addTeacherToClass} from "../utils/operations/classOps";
import { addUserToOrganizationAndValidate, createClass, createRole } from "../utils/operations/organizationOps";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { BillySuperAdminAuthToken, JoeAuthToken, BillyAuthToken } from "../utils/testConfig";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { PermissionName } from "../../src/permissions/permissionNames";
import { grantPermission } from "../utils/operations/roleOps";

const GET_CLASSES = `
    query getClasses {
        classes {
            class_id
            class_name
        }
    }
`;

const GET_CLASS = `
    query myQuery($class_id: ID!) {
        class(class_id: $class_id) {
            class_id
            class_name
        }
    }
`;

describe("model.class", () => {
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

    describe("getClasses", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when none", () => {
            it("should return an empty array", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_CLASSES,
                    headers: { authorization: JoeAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const classes = res.data?.classes as Class[];
                expect(classes).to.exist;
                expect(classes).to.be.empty;
            });
        });

        context("when one and admin token", () => {
            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                await createUserBilly(testClient);
                const userId = user.user_id
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                const organizationId = organization.organization_id

                await createClass(testClient, organization.organization_id);
            });

            it("should return an array containing one class", async () => {
                const { query } = testClient;

                const res = await query({
                     query: GET_CLASSES,
                     headers: { authorization: BillySuperAdminAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const classes = res.data?.classes as Class[];
                expect(classes).to.exist;
                expect(classes).to.have.lengthOf(1);
            });
        });

        context("when one and user is a student in the class", () => {
            
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganizationAndValidate(testClient, orgOwner.user_id);
                await addUserToOrganizationAndValidate(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.add_students_to_class_20225, { authorization: JoeAuthToken });
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                await addStudentToClass(testClient, cls.class_id, user.user_id, { authorization: BillyAuthToken });
            });


            it("should return an array containing one class", async () => {
                const { query } = testClient;

                const res = await query({
                     query: GET_CLASSES,
                     headers: { authorization: BillyAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const classes = res.data?.classes as Class[];
                expect(classes).to.exist;
                expect(classes).to.have.lengthOf(1);
            });
        });

        context("when one and user is a teacher of the class", () => {
            
            let user: User;
            let cls: Class;

            beforeEach(async () => {
                const orgOwner = await createUserJoe(testClient);
                user = await createUserBilly(testClient);
                const organization = await createOrganizationAndValidate(testClient, orgOwner.user_id);
                await addUserToOrganizationAndValidate(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
                cls = await createClass(testClient, organization.organization_id);
                const role = await createRole(testClient, organization.organization_id);
                await grantPermission(testClient, role.role_id, PermissionName.add_teachers_to_class_20226, { authorization: JoeAuthToken });
                await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                await addTeacherToClass(testClient, cls.class_id, user.user_id, { authorization: BillyAuthToken });
                
            });


            it("should return an array containing one class", async () => {
                const { query } = testClient;

                const res = await query({
                     query: GET_CLASSES,
                     headers: { authorization: BillyAuthToken },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const classes = res.data?.classes as Class[];
                expect(classes).to.exist;
                expect(classes).to.have.lengthOf(1);
            });
        });
    });

      
    

    describe("getClass", () => {
        beforeEach(async () => {
            await connection.synchronize(true);
        });

        context("when none", () => {
            it("should return null", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_CLASS,
                    variables: { class_id: accountUUID() },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                expect(res.data?.class).to.be.null;
            });
        });

        context("when one", () => {
            let cls: Class;

            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganizationAndValidate(testClient, user.user_id);
                cls = await createClass(testClient, organization.organization_id);
            });

            it("should return the class associated with the specified ID", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_CLASS,
                    variables: { class_id: cls.class_id },
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const gqlClass = res.data?.class as Class;
                expect(gqlClass).to.exist;
                expect(cls).to.include(gqlClass);
            });
        });
    });
});
