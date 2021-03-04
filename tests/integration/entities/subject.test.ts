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
import { createSubject } from "../../factories/subject.factory";
import { createTestConnection } from "../../utils/testConnection";
import { deleteSubject } from "../../utils/operations/subjectOps";
import { grantPermission } from "../../utils/operations/roleOps";
import { Model } from "../../../src/model";
import { Role } from "../../../src/entities/role";
import { Organization } from "../../../src/entities/organization";
import { PermissionName } from "../../../src/permissions/permissionNames";
import { Subject } from "../../../src/entities/subject";
import { Status } from "../../../src/entities/status";
import { User } from "../../../src/entities/user";

use(chaiAsPromised);

describe("Subject", () => {
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
        let subject : Subject;
        let organizationId: string;
        let userId: string;

        beforeEach(async () => {
            user = await createUserJoe(testClient)
            userId = user.user_id
            org = createOrganization()
            await connection.manager.save(org);
            organizationId = org.organization_id
            subject = createSubject(org);
            await connection.manager.save(subject);
        });

        context("when user is not logged in", () => {
            it("cannot find the subject", async () => {
                const gqlBool = await deleteSubject(testClient, subject.id, { authorization: undefined })

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

                context("and does not belong to the organization from the subject", () => {
                    it("cannot find the subject", async () => {
                        const gqlBool = await deleteSubject(testClient, subject.id, { authorization: undefined })

                        expect(gqlBool).to.be.undefined
                    });
                });

                context("and belongs to the organization from the subject", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                        roleId = (await createRole(testClient, organizationId, "My Role")).role_id;
                        await addRoleToOrganizationMembership(testClient, otherUserId, organizationId, roleId, { authorization: JoeAuthToken });
                    });

                    context("with a non system subject", () => {
                        context("and has delete subject permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_subjects_20447, { authorization: JoeAuthToken });
                            });

                            it("deletes the expected subject", async () => {
                                let dbSubject = await Subject.findOneOrFail(subject.id)

                                expect(dbSubject.status).to.eq(Status.ACTIVE)
                                expect(dbSubject.deleted_at).to.be.null

                                const gqlBool = await deleteSubject(testClient, subject.id, { authorization: BillyAuthToken })

                                expect(gqlBool).to.be.true
                                dbSubject = await Subject.findOneOrFail(subject.id)
                                expect(dbSubject.status).to.eq(Status.INACTIVE)
                                expect(dbSubject.deleted_at).not.to.be.null
                            });

                            context("with the subject already deleted", () => {
                                beforeEach(async () => {
                                    await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })
                                });

                                it("cannot delete the subject", async () => {
                                    const gqlBool = await deleteSubject(testClient, subject.id, { authorization: BillyAuthToken })

                                    expect(gqlBool).to.be.false
                                    const dbSubject = await Subject.findOneOrFail(subject.id)
                                    expect(dbSubject.status).to.eq(Status.INACTIVE)
                                    expect(dbSubject.deleted_at).not.to.be.null
                                });
                            });
                        });

                        context("and does not have delete subject permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteSubject(testClient, subject.id, { authorization: BillyAuthToken })
                                expect(fn()).to.be.rejected;
                                const dbSubject = await Subject.findOneOrFail(subject.id)
                                expect(dbSubject.status).to.eq(Status.ACTIVE)
                                expect(dbSubject.deleted_at).to.be.null
                            });
                        });
                    });

                    context("with a system subject", () => {
                        beforeEach(async () => {
                            subject.system = true
                            await connection.manager.save(subject);
                        });

                        context("and has delete subject permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_subjects_20447, { authorization: JoeAuthToken });
                            });

                            it("raises a permission error", async () => {
                                const fn = () => deleteSubject(testClient, subject.id, { authorization: BillyAuthToken })
                                expect(fn()).to.be.rejected;
                                const dbSubject = await Subject.findOneOrFail(subject.id)
                                expect(dbSubject.status).to.eq(Status.ACTIVE)
                                expect(dbSubject.deleted_at).to.be.null
                            });
                        });

                        context("and does not have delete subject permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteSubject(testClient, subject.id, { authorization: BillyAuthToken })
                                expect(fn()).to.be.rejected;
                                const dbSubject = await Subject.findOneOrFail(subject.id)
                                expect(dbSubject.status).to.eq(Status.ACTIVE)
                                expect(dbSubject.deleted_at).to.be.null
                            });
                        });
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and does not belong to the organization from the subject", () => {
                    it("deletes the expected subject", async () => {
                        let dbSubject = await Subject.findOneOrFail(subject.id)

                        expect(dbSubject.status).to.eq(Status.ACTIVE)
                        expect(dbSubject.deleted_at).to.be.null

                        const gqlBool = await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })

                        expect(gqlBool).to.be.true
                        dbSubject = await Subject.findOneOrFail(subject.id)
                        expect(dbSubject.status).to.eq(Status.INACTIVE)
                        expect(dbSubject.deleted_at).not.to.be.null
                    });
                });

                context("and belongs to the organization from the subject", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
                    });

                    context("with a non system subject", () => {
                        it("deletes the expected subject", async () => {
                            let dbSubject = await Subject.findOneOrFail(subject.id)

                            expect(dbSubject.status).to.eq(Status.ACTIVE)
                            expect(dbSubject.deleted_at).to.be.null

                            const gqlBool = await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })

                            expect(gqlBool).to.be.true
                            dbSubject = await Subject.findOneOrFail(subject.id)
                            expect(dbSubject.status).to.eq(Status.INACTIVE)
                            expect(dbSubject.deleted_at).not.to.be.null
                        });

                        context("with the subject already deleted", () => {
                            beforeEach(async () => {
                                await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })
                            });

                            it("cannot delete the subject", async () => {
                                const gqlBool = await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })

                                expect(gqlBool).to.be.false
                                const dbSubject = await Subject.findOneOrFail(subject.id)
                                expect(dbSubject.status).to.eq(Status.INACTIVE)
                                expect(dbSubject.deleted_at).not.to.be.null
                            });
                        });
                    });

                    context("with a system subject", () => {
                        beforeEach(async () => {
                            subject.system = true
                            await connection.manager.save(subject);
                        });

                        it("deletes the expected subject", async () => {
                            let dbSubject = await Subject.findOneOrFail(subject.id)

                            expect(dbSubject.status).to.eq(Status.ACTIVE)
                            expect(dbSubject.deleted_at).to.be.null

                            const gqlBool = await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })

                            expect(gqlBool).to.be.true
                            dbSubject = await Subject.findOneOrFail(subject.id)
                            expect(dbSubject.status).to.eq(Status.INACTIVE)
                            expect(dbSubject.deleted_at).not.to.be.null
                        });

                        context("with the subject already deleted", () => {
                            beforeEach(async () => {
                                await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })
                            });

                            it("cannot delete the subject", async () => {
                                const gqlBool = await deleteSubject(testClient, subject.id, { authorization: JoeAuthToken })

                                expect(gqlBool).to.be.false
                                const dbSubject = await Subject.findOneOrFail(subject.id)
                                expect(dbSubject.status).to.eq(Status.INACTIVE)
                                expect(dbSubject.deleted_at).not.to.be.null
                            });
                        });
                    });
                });
            });
        });
    });
});
