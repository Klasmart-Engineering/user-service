import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Class} from "../../src/entities/class";
import { addUserToOrganizationAndValidate, createClass, createRole, createSchool } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate, userToPayload } from "../utils/operations/userOps";
import { createDefaultRoles } from "../utils/operations/modelOps";
import { createUserBilly, createUserJoe } from "../utils/testEntities";
import { accountUUID, User } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { JoeAuthToken, BillyAuthToken, generateToken } from "../utils/testConfig";
import { addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { PermissionName } from "../../src/permissions/permissionNames";
import { grantPermission } from "../utils/operations/roleOps";
import { createUserAndValidate } from "../utils/operations/modelOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { addRoleToSchoolMembership } from "../utils/operations/schoolMembershipOps";
import { UserPermissions } from "../../src/permissions/userPermissions";
import { addStudentToClass, addTeacherToClass } from "../utils/operations/classOps";
import { ClassConnection } from "../../src/utils/pagingconnections";

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

const GET_V1_CLASSES = `
    query myQuery($after:String,$before:String,$first:Int,$last:Int) {
        classes_v1(after:$after,before:$before,first:$first,last:$last) {
            total
            edges {
                class_id
                class_name
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

describe("model.class", () => {
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
        await createDefaultRoles(testClient, { authorization: JoeAuthToken });
    });

    describe("getClasses", () => {
        context("when none", () => {
            it("should return an empty array", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_CLASSES,
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const classes = res.data?.classes as Class[];
                expect(classes).to.exist;
                expect(classes).to.have.lengthOf(0);
            });
        });

        context("when one", () => {
            beforeEach(async () => {
                const user = await createUserJoe(testClient);
                const organization = await createOrganizationAndValidate(testClient, user.user_id, JoeAuthToken);
                await createClass(testClient, organization.organization_id,undefined,{ authorization: JoeAuthToken });
            });

            it("should return an array containing one class", async () => {
                const { query } = testClient;

                const res = await query({
                    query: GET_CLASSES,
                });

                expect(res.errors, res.errors?.toString()).to.be.undefined;
                const classes = res.data?.classes as Class[];
                expect(classes).to.exist;
                expect(classes).to.have.lengthOf(1);
            });
        });
    });

    

    describe("getClass", () => {
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
                const organization = await createOrganizationAndValidate(testClient, user.user_id, undefined, JoeAuthToken);
                cls = await createClass(testClient, organization.organization_id,undefined,{ authorization: JoeAuthToken });
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
