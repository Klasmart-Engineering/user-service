import { expect, use } from "chai";
import { Connection } from "typeorm";
import chaiAsPromised from "chai-as-promised";

import { ApolloServerTestClient, createTestClient } from "../../utils/createTestClient";
import { addUserToOrganizationAndValidate, createRole } from "../../utils/operations/organizationOps";
import { addRoleToOrganizationMembership } from "../../utils/operations/organizationMembershipOps";
import { BillyAuthToken, JoeAuthToken } from "../../utils/testConfig";
import { createServer } from "../../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../../utils/testEntities";
import { createOrganization } from "../../factories/organization.factory";
import { createCategory } from "../../factories/category.factory";
import { createTestConnection } from "../../utils/testConnection";
import { deleteCategory } from "../../utils/operations/categoryOps";
import { grantPermission } from "../../utils/operations/roleOps";
import { Model } from "../../../src/model";
import { Role } from "../../../src/entities/role";
import { Organization } from "../../../src/entities/organization";
import { PermissionName } from "../../../src/permissions/permissionNames";
import { Category } from "../../../src/entities/category";
import { Status } from "../../../src/entities/status";
import { User } from "../../../src/entities/user";

use(chaiAsPromised);

describe("Category", () => {
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
        let category : Category;
        let organizationId: string;
        let userId: string;

        beforeEach(async () => {
            user = await createUserJoe(testClient)
            userId = user.user_id
            org = createOrganization()
            await connection.manager.save(org);
            organizationId = org.organization_id
            category = createCategory(org);
            await connection.manager.save(category);
        });

        context("when user is not logged in", () => {
            it("cannot find the category", async () => {
                const gqlBool = await deleteCategory(testClient, category.id, { authorization: undefined })

                expect(gqlBool).to.be.undefined
            });
        });

        context("when user is logged in", () => {
            let otherUserId: string;
            let roleId: string;

            context("and the user is not an admin", () => {
                beforeEach(async () => {
                    const otherUser = await createUserBilly(testClient);
                    otherUserId = otherUser.user_id
                });

                context("and does not belong to the organization from the category", () => {
                    it("cannot find the category", async () => {
                        const gqlBool = await deleteCategory(testClient, category.id, { authorization: undefined })

                        expect(gqlBool).to.be.undefined
                    });
                });

                context("and belongs to the organization from the category", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                        roleId = (await createRole(testClient, organizationId, "My Role")).role_id;
                        await addRoleToOrganizationMembership(testClient, otherUserId, organizationId, roleId, { authorization: JoeAuthToken });
                    });

                    context("with a non system category", () => {
                        context("and has delete category permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_subjects_20447, { authorization: JoeAuthToken });
                            });

                            it("deletes the expected category", async () => {
                                let dbCategory = await Category.findOneOrFail(category.id)

                                expect(dbCategory.status).to.eq(Status.ACTIVE)
                                expect(dbCategory.deleted_at).to.be.null

                                const gqlBool = await deleteCategory(testClient, category.id, { authorization: BillyAuthToken })

                                expect(gqlBool).to.be.true
                                dbCategory = await Category.findOneOrFail(category.id)
                                expect(dbCategory.status).to.eq(Status.INACTIVE)
                                expect(dbCategory.deleted_at).not.to.be.null
                            });

                            context("with the category already deleted", () => {
                                beforeEach(async () => {
                                    await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })
                                });

                                it("cannot delete the category", async () => {
                                    const gqlBool = await deleteCategory(testClient, category.id, { authorization: BillyAuthToken })

                                    expect(gqlBool).to.be.false
                                    const dbCategory = await Category.findOneOrFail(category.id)
                                    expect(dbCategory.status).to.eq(Status.INACTIVE)
                                    expect(dbCategory.deleted_at).not.to.be.null
                                });
                            });
                        });

                        context("and does not have delete category permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteCategory(testClient, category.id, { authorization: BillyAuthToken })
                                expect(fn()).to.be.rejected;
                                const dbCategory = await Category.findOneOrFail(category.id)
                                expect(dbCategory.status).to.eq(Status.ACTIVE)
                                expect(dbCategory.deleted_at).to.be.null
                            });
                        });
                    });

                    context("with a system category", () => {
                        beforeEach(async () => {
                            category.system = true
                            await connection.manager.save(category);
                        });

                        context("and has delete category permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_subjects_20447, { authorization: JoeAuthToken });
                            });

                            it("raises a permission error", async () => {
                                const fn = () => deleteCategory(testClient, category.id, { authorization: BillyAuthToken })
                                expect(fn()).to.be.rejected;
                                const dbCategory = await Category.findOneOrFail(category.id)
                                expect(dbCategory.status).to.eq(Status.ACTIVE)
                                expect(dbCategory.deleted_at).to.be.null
                            });
                        });

                        context("and does not have delete category permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteCategory(testClient, category.id, { authorization: BillyAuthToken })
                                expect(fn()).to.be.rejected;
                                const dbCategory = await Category.findOneOrFail(category.id)
                                expect(dbCategory.status).to.eq(Status.ACTIVE)
                                expect(dbCategory.deleted_at).to.be.null
                            });
                        });
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and does not belong to the organization from the category", () => {
                    it("deletes the expected category", async () => {
                        let dbCategory = await Category.findOneOrFail(category.id)

                        expect(dbCategory.status).to.eq(Status.ACTIVE)
                        expect(dbCategory.deleted_at).to.be.null

                        const gqlBool = await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })

                        expect(gqlBool).to.be.true
                        dbCategory = await Category.findOneOrFail(category.id)
                        expect(dbCategory.status).to.eq(Status.INACTIVE)
                        expect(dbCategory.deleted_at).not.to.be.null
                    });
                });

                context("and belongs to the organization from the category", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
                    });

                    context("with a non system category", () => {
                        it("deletes the expected category", async () => {
                            let dbCategory = await Category.findOneOrFail(category.id)

                            expect(dbCategory.status).to.eq(Status.ACTIVE)
                            expect(dbCategory.deleted_at).to.be.null

                            const gqlBool = await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })

                            expect(gqlBool).to.be.true
                            dbCategory = await Category.findOneOrFail(category.id)
                            expect(dbCategory.status).to.eq(Status.INACTIVE)
                            expect(dbCategory.deleted_at).not.to.be.null
                        });

                        context("with the category already deleted", () => {
                            beforeEach(async () => {
                                await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })
                            });

                            it("cannot delete the category", async () => {
                                const gqlBool = await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })

                                expect(gqlBool).to.be.false
                                const dbCategory = await Category.findOneOrFail(category.id)
                                expect(dbCategory.status).to.eq(Status.INACTIVE)
                                expect(dbCategory.deleted_at).not.to.be.null
                            });
                        });
                    });

                    context("with a system category", () => {
                        beforeEach(async () => {
                            category.system = true
                            await connection.manager.save(category);
                        });

                        it("deletes the expected category", async () => {
                            let dbCategory = await Category.findOneOrFail(category.id)

                            expect(dbCategory.status).to.eq(Status.ACTIVE)
                            expect(dbCategory.deleted_at).to.be.null

                            const gqlBool = await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })

                            expect(gqlBool).to.be.true
                            dbCategory = await Category.findOneOrFail(category.id)
                            expect(dbCategory.status).to.eq(Status.INACTIVE)
                            expect(dbCategory.deleted_at).not.to.be.null
                        });

                        context("with the category already deleted", () => {
                            beforeEach(async () => {
                                await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })
                            });

                            it("cannot delete the category", async () => {
                                const gqlBool = await deleteCategory(testClient, category.id, { authorization: JoeAuthToken })

                                expect(gqlBool).to.be.false
                                const dbCategory = await Category.findOneOrFail(category.id)
                                expect(dbCategory.status).to.eq(Status.INACTIVE)
                                expect(dbCategory.deleted_at).not.to.be.null
                            });
                        });
                    });
                });
            });
        });
    });
});



