import { expect, use } from "chai";
import { Connection } from "typeorm";
import chaiAsPromised from "chai-as-promised";

import { AgeRange } from "../../../src/entities/ageRange";
import { ApolloServerTestClient, createTestClient } from "../../utils/createTestClient";
import { addUserToOrganizationAndValidate, createRole } from "../../utils/operations/organizationOps";
import { addRoleToOrganizationMembership } from "../../utils/operations/organizationMembershipOps";
import { getBillyAuthToken, getJoeAuthToken } from "../../utils/testConfig";
import { createAgeRange } from "../../factories/ageRange.factory";
import { createServer } from "../../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../../utils/testEntities";
import { createOrganization } from "../../factories/organization.factory";
import { createTestConnection } from "../../utils/testConnection";
import { deleteAgeRange } from "../../utils/operations/ageRangeOps";
import { grantPermission } from "../../utils/operations/roleOps";
import { Model } from "../../../src/model";
import { Role } from "../../../src/entities/role";
import { Organization } from "../../../src/entities/organization";
import { PermissionName } from "../../../src/permissions/permissionNames";
import { Status } from "../../../src/entities/status";
import { User } from "../../../src/entities/user";

use(chaiAsPromised);

describe("ageRange", () => {
    let connection: Connection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    });

    after(async () => {
        await connection?.close()
    });

    describe("delete", () => {
        let user: User;
        let org : Organization;
        let ageRange : AgeRange;
        let organizationId: string;
        let userId: string;

        beforeEach(async () => {
            user = await createUserJoe(testClient)
            userId = user.user_id
            org = createOrganization()
            await connection.manager.save(org);
            organizationId = org.organization_id
            ageRange = createAgeRange(org);
            await connection.manager.save(ageRange);
        });

        context("when user is not logged in", () => {
            it("cannot find the age range", async () => {
                const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: undefined })

                expect(gqlBool).to.be.undefined
            });
        });

        context("when user is logged in", () => {
            let otherUserId: string;
            let roleId: string;
            let otherUser: User;

            context("and the user is not an admin", () => {
                beforeEach(async () => {
                    otherUser = await createUserBilly(testClient);
                    otherUserId = otherUser.user_id
                });

                context("and does not belong to the organization from the age range", () => {
                    it("cannot find the age range", async () => {
                        const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getBillyAuthToken() }, { user_id: otherUser.user_id })

                        expect(gqlBool).to.be.undefined
                    });
                });

                context("and belongs to the organization from the age range", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: getJoeAuthToken() }, { user_id: user.user_id });
                        roleId = (await createRole(testClient, organizationId, "My Role", undefined, undefined, { user_id: user.user_id })).role_id;
                        await addRoleToOrganizationMembership(testClient, otherUserId, organizationId, roleId, { authorization: getJoeAuthToken() }, { user_id: user.user_id });
                    });

                    context("with a non system age range", () => {
                        context("and has delete age range permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_age_range_20442, { authorization: getJoeAuthToken() }, { user_id: user.user_id });
                            });

                            it("deletes the expected age range", async () => {
                                let dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                                expect(dbAgeRange.status).to.eq(Status.ACTIVE)
                                expect(dbAgeRange.deleted_at).to.be.null

                                const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getBillyAuthToken() }, { user_id: otherUser.user_id })

                                expect(gqlBool).to.be.true
                                dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)
                                expect(dbAgeRange.status).to.eq(Status.INACTIVE)
                                expect(dbAgeRange.deleted_at).not.to.be.null
                            });

                            context("with the age range already deleted", () => {
                                beforeEach(async () => {
                                    await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })
                                });

                                it("cannot delete the age range", async () => {
                                    const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getBillyAuthToken() }, { user_id: otherUser.user_id })

                                    expect(gqlBool).to.be.false
                                    const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)
                                    expect(dbAgeRange.status).to.eq(Status.INACTIVE)
                                    expect(dbAgeRange.deleted_at).not.to.be.null
                                });
                            });
                        });

                        context("and does not have delete age range permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteAgeRange(testClient, ageRange.id, { authorization: getBillyAuthToken() }, { user_id: otherUser.user_id })

                                expect(fn()).to.be.rejected;
                                const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                                expect(dbAgeRange.status).to.eq(Status.ACTIVE)
                                expect(dbAgeRange.deleted_at).to.be.null
                            });
                        });
                    });

                    context("with a system age range", () => {
                        beforeEach(async () => {
                            ageRange.system = true
                            await connection.manager.save(ageRange);
                        });

                        context("and has delete age range permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_age_range_20442, { authorization: getJoeAuthToken() }, { user_id: user.user_id });
                            });

                            it("raises a permission error", async () => {
                                const fn = () => deleteAgeRange(testClient, ageRange.id, { authorization: getBillyAuthToken() }, { user_id: otherUser.user_id })

                                expect(fn()).to.be.rejected;
                                const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                                expect(dbAgeRange.status).to.eq(Status.ACTIVE)
                                expect(dbAgeRange.deleted_at).to.be.null
                            });
                        });

                        context("and does not have delete age range permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteAgeRange(testClient, ageRange.id, { authorization: getBillyAuthToken() }, { user_id: otherUser.user_id })

                                expect(fn()).to.be.rejected;
                                const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                                expect(dbAgeRange.status).to.eq(Status.ACTIVE)
                                expect(dbAgeRange.deleted_at).to.be.null
                            });
                        });
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and does not belong to the organization from the age range", () => {
                    it("deletes the expected age range", async () => {
                        let dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                        expect(dbAgeRange.status).to.eq(Status.ACTIVE)
                        expect(dbAgeRange.deleted_at).to.be.null

                        const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })

                        expect(gqlBool).to.be.true
                        dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)
                        expect(dbAgeRange.status).to.eq(Status.INACTIVE)
                        expect(dbAgeRange.deleted_at).not.to.be.null
                    });
                });

                context("and belongs to the organization from the age range", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: getJoeAuthToken() }, { user_id: user.user_id });
                    });

                    context("with a non system age range", () => {
                        it("deletes the expected age range", async () => {
                            let dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                            expect(dbAgeRange.status).to.eq(Status.ACTIVE)
                            expect(dbAgeRange.deleted_at).to.be.null

                            const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })

                            expect(gqlBool).to.be.true
                            dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)
                            expect(dbAgeRange.status).to.eq(Status.INACTIVE)
                            expect(dbAgeRange.deleted_at).not.to.be.null
                        });

                        context("with the age range already deleted", () => {
                            beforeEach(async () => {
                                await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })
                            });

                            it("cannot delete the age range", async () => {
                                const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })

                                expect(gqlBool).to.be.false
                                const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)
                                expect(dbAgeRange.status).to.eq(Status.INACTIVE)
                                expect(dbAgeRange.deleted_at).not.to.be.null
                            });
                        });
                    });

                    context("with a system age range", () => {
                        beforeEach(async () => {
                            ageRange.system = true
                            await connection.manager.save(ageRange);
                        });

                        it("deletes the expected age range", async () => {
                            let dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)

                            expect(dbAgeRange.status).to.eq(Status.ACTIVE)
                            expect(dbAgeRange.deleted_at).to.be.null

                            const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })

                            expect(gqlBool).to.be.true
                            dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)
                            expect(dbAgeRange.status).to.eq(Status.INACTIVE)
                            expect(dbAgeRange.deleted_at).not.to.be.null
                        });

                        context("with the age range already deleted", () => {
                            beforeEach(async () => {
                                await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })
                            });

                            it("cannot delete the age range", async () => {
                                const gqlBool = await deleteAgeRange(testClient, ageRange.id, { authorization: getJoeAuthToken() }, { user_id: user.user_id })

                                expect(gqlBool).to.be.false
                                const dbAgeRange = await AgeRange.findOneOrFail(ageRange.id)
                                expect(dbAgeRange.status).to.eq(Status.INACTIVE)
                                expect(dbAgeRange.deleted_at).not.to.be.null
                            });
                        });
                    });
                });
            });
        });
    });
});

