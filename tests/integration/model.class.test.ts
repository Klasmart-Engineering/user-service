import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Class} from "../../src/entities/class";
import { addUserToOrganizationAndValidate, createClass, createRole, createSchool } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate, userToPayload } from "../utils/operations/userOps";
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
    });

    after(async () => {
        await connection?.close();
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
    describe("getv1Classes", () => {
        let user: User;
        let user2: User;
        const orgIds: string[] = []
        let originalAdmins: string[];
         beforeEach(async () => {
             user2 = await createUserJoe(testClient);
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
                 const role1Id = (await createRole(testClient, organization1.organization_id, "role " + i, "role description " + 1, anne1Token)).role_id;
                 await addRoleToOrganizationMembership(testClient, user.user_id, organization1.organization_id, role1Id, { authorization: anne1Token });
                 const school1 = await createSchool(testClient, organization1.organization_id, "school " + i, { authorization: anne1Token })
                 await addUserToSchool(testClient, user.user_id, school1.school_id, { authorization: anne1Token })
                 await addRoleToSchoolMembership(testClient, user.user_id, school1.school_id, role1Id, { authorization: anne1Token })
                 const cls1 = await createClass(testClient, organization1.organization_id, "class " + i, { authorization: anne1Token });
                 await grantPermission(testClient, role1Id, PermissionName.add_students_to_class_20225, { authorization: anne1Token });
                 await grantPermission(testClient, role1Id, PermissionName.add_teachers_to_class_20226, { authorization: anne1Token });
                 if( (i % 2) > 0){
                     await addTeacherToClass(testClient, cls1.class_id, user.user_id, { authorization: BillyAuthToken });
                 } else {
                    await addStudentToClass(testClient, cls1.class_id, user.user_id, { authorization: BillyAuthToken });
                }
             }

         });

        it("should get paged classes as admin", async () => {
            const { query } = testClient;
            const res = await query({
                    query: GET_V1_CLASSES,
                    headers: { authorization: JoeAuthToken },
                    variables:{first:5}
                });

            expect(res.errors, res.errors?.toString()).to.be.undefined;
            const classesConn = res.data?.classes_v1 as ClassConnection;
            expect(classesConn).to.exist;
            expect(classesConn.total).to.equal(9)
            let classes = classesConn.edges
            expect(classes).to.have.lengthOf(5);
            let pageInfo = classesConn.pageInfo
            expect (pageInfo).to.exist
            expect(pageInfo?.hasNextPage)
            expect(!pageInfo?.hasPreviousPage)

            const res2 = await query({
                    query: GET_V1_CLASSES,
                    headers: { authorization: JoeAuthToken },
                    variables:{after:pageInfo?.endCursor, first:5}
                });

            expect(res2.errors, res2.errors?.toString()).to.be.undefined;
            const classesConn2 = res2.data?.classes_v1 as ClassConnection;
            expect(classesConn2).to.exist;
            expect(classesConn2.total).to.equal(9)
            let classes2 = classesConn2.edges
            expect(classes2).to.have.lengthOf(4);
            let pageInfo2 = classesConn2.pageInfo
            expect (pageInfo2).to.exist
            expect(!pageInfo2?.hasNextPage)
            expect(pageInfo2?.hasPreviousPage)

            const res3 = await query({
                    query: GET_V1_CLASSES,
                    headers: { authorization: JoeAuthToken },
                    variables:{before:pageInfo2?.startCursor, last:5}
                });

            expect(res3.errors, res3.errors?.toString()).to.be.undefined;
            const classesConn3 = res3.data?.classes_v1 as ClassConnection;
            expect(classesConn3).to.exist;
            expect(classesConn3.total).to.equal(9)
            let classes3 = classesConn3.edges
            expect(classes3).to.have.lengthOf(5);
            let pageInfo3 = classesConn3.pageInfo
            expect (pageInfo3).to.exist
            expect(pageInfo3?.hasNextPage)
            expect(!pageInfo3?.hasPreviousPage)
        });
        it("should get paged classes as user", async () => {
            const { query } = testClient;
            const res = await query({
                    query: GET_V1_CLASSES,
                    headers: { authorization: BillyAuthToken },
                    variables:{first:5}
                });

            expect(res.errors, res.errors?.toString()).to.be.undefined;
            const classesConn = res.data?.classes_v1 as ClassConnection;
            expect(classesConn).to.exist;
            expect(classesConn.total).to.equal(9)
            let classes = classesConn.edges
            expect(classes).to.have.lengthOf(5);
            let pageInfo = classesConn.pageInfo
            expect (pageInfo).to.exist
            expect(pageInfo?.hasNextPage)

            const res2 = await query({
                    query: GET_V1_CLASSES,
                    headers: { authorization: BillyAuthToken },
                    variables:{after:pageInfo?.endCursor, first:5}
                });

            expect(res2.errors, res2.errors?.toString()).to.be.undefined;
            const classesConn2 = res2.data?.classes_v1 as ClassConnection;
            expect(classesConn2).to.exist;
             expect(classesConn2.total).to.equal(9)
            let classes2 = classesConn2.edges
            expect(classes2).to.have.lengthOf(4);
            let pageInfo2 = classesConn2.pageInfo
            expect (pageInfo2).to.exist
            expect(!pageInfo2?.hasNextPage)
            expect(pageInfo2?.hasPreviousPage)

            const res3 = await query({
                    query: GET_V1_CLASSES,
                    headers: { authorization: BillyAuthToken },
                    variables:{before:pageInfo2?.startCursor, last:5}
                });

            expect(res3.errors, res3.errors?.toString()).to.be.undefined;
            const classesConn3 = res3.data?.classes_v1 as ClassConnection;
            expect(classesConn3).to.exist;
            expect(classesConn3.total).to.equal(9)
            let classes3 = classesConn3.edges
            expect(classes3).to.have.lengthOf(5);
            let pageInfo3 = classesConn3.pageInfo
            expect (pageInfo3).to.exist
            expect(pageInfo3?.hasNextPage)
            expect(!pageInfo3?.hasPreviousPage)

        });
    });

});
