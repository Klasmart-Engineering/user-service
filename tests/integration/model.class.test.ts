import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Class} from "../../src/entities/class";
import { createClass } from "../utils/operations/organizationOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/testEntities";
import { accountUUID } from "../../src/entities/user";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { getJoeAuthToken } from "../utils/testConfig";

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
                const organization = await createOrganizationAndValidate(testClient, user.user_id, getJoeAuthToken());
                await createClass(testClient, organization.organization_id,undefined, undefined, { authorization: getJoeAuthToken() }, { user_id: user.user_id });
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
                const organization = await createOrganizationAndValidate(testClient, user.user_id, undefined, undefined, getJoeAuthToken());
                cls = await createClass(testClient, organization.organization_id,undefined, undefined,  { authorization: getJoeAuthToken() }, { user_id: user.user_id });
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
