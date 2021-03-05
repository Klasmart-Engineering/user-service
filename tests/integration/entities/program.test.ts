import { expect, use } from "chai";
import { Connection } from "typeorm";
import chaiAsPromised from "chai-as-promised";

import { Program } from "../../../src/entities/program";
import { ApolloServerTestClient, createTestClient } from "../../utils/createTestClient";
import { addUserToOrganizationAndValidate, createRole } from "../../utils/operations/organizationOps";
import { addRoleToOrganizationMembership } from "../../utils/operations/organizationMembershipOps";
import { BillyAuthToken, JoeAuthToken } from "../../utils/testConfig";
import { createProgram } from "../../factories/program.factory"
import { createServer } from "../../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../../utils/testEntities";
import { createOrganization } from "../../factories/organization.factory";
import { createTestConnection } from "../../utils/testConnection";
import { deleteProgram } from "../../utils/operations/programOps";
import { grantPermission } from "../../utils/operations/roleOps";
import { Model } from "../../../src/model";
import { Organization } from "../../../src/entities/organization";
import { PermissionName } from "../../../src/permissions/permissionNames";
import { Status } from "../../../src/entities/status";
import { User } from "../../../src/entities/user";

use(chaiAsPromised);


describe("program", () => {
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
        let program : Program;
        let organizationId: string;
        let userId: string;

        beforeEach(async () => {
            user = await createUserJoe(testClient)
            userId = user.user_id
          
            org = createOrganization()
            await connection.manager.save(org);
            organizationId = org.organization_id
            program = createProgram(org);
            await connection.manager.save(program);
        });

        context("when user is not logged in", () => {
            it("cannot find the program", async () => {
                const gqlBool = await deleteProgram(testClient, program.id, { authorization: undefined })

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

                context("and does not belong to the organization from the program", () => {
                    it("cannot find the program", async () => {
                        const gqlBool = await deleteProgram(testClient, program.id, { authorization: BillyAuthToken })

                        expect(gqlBool).to.be.undefined
                    });
                });

                context("and belongs to the organization from the program", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                        roleId = (await createRole(testClient, organizationId, "My Role")).role_id;
                        await addRoleToOrganizationMembership(testClient, otherUserId, organizationId, roleId, { authorization: JoeAuthToken });
                    });

                    context("with a non system program", () => {
                        context("and has delete program permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_program_20441, { authorization: JoeAuthToken });
                            });

                            it("deletes the expected program", async () => {
                                let dbProgram = await Program.findOneOrFail(program.id)

                                expect(dbProgram.status).to.eq(Status.ACTIVE)
                                expect(dbProgram.deleted_at).to.be.null

                                const gqlBool = await deleteProgram(testClient, program.id, { authorization: BillyAuthToken })

                                expect(gqlBool).to.be.true
                                dbProgram = await Program.findOneOrFail(program.id)
                                expect(dbProgram.status).to.eq(Status.INACTIVE)
                                expect(dbProgram.deleted_at).not.to.be.null
                            });

                            context("with the program already deleted", () => {
                                beforeEach(async () => {
                                    await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })
                                });

                                it("cannot delete the program", async () => {
                                    const gqlBool = await deleteProgram(testClient, program.id, { authorization: BillyAuthToken })

                                    expect(gqlBool).to.be.false
                                    const dbProgram = await Program.findOneOrFail(program.id)
                                    expect(dbProgram.status).to.eq(Status.INACTIVE)
                                    expect(dbProgram.deleted_at).not.to.be.null
                                });
                            });
                        });

                        context("and does not have delete program permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteProgram(testClient, program.id, { authorization: BillyAuthToken })

                                expect(fn()).to.be.rejected;
                                const dbProgram = await Program.findOneOrFail(program.id)

                                expect(dbProgram.status).to.eq(Status.ACTIVE)
                                expect(dbProgram.deleted_at).to.be.null
                            });
                        });
                    });

                    context("with a system program", () => {
                        beforeEach(async () => {
                            program.system = true
                            await connection.manager.save(program);
                        });

                        context("and has delete program permissions", () => {
                            beforeEach(async () => {
                                await grantPermission(testClient, roleId, PermissionName.delete_age_range_20442, { authorization: JoeAuthToken });
                            });

                            it("raises a permission error", async () => {
                                const fn = () => deleteProgram(testClient, program.id, { authorization: BillyAuthToken })

                                expect(fn()).to.be.rejected;
                                const dbProgram = await Program.findOneOrFail(program.id)

                                expect(dbProgram.status).to.eq(Status.ACTIVE)
                                expect(dbProgram.deleted_at).to.be.null
                            });
                        });

                        context("and does not have delete program permissions", () => {
                            it("raises a permission error", async () => {
                                const fn = () => deleteProgram(testClient, program.id, { authorization: BillyAuthToken })

                                expect(fn()).to.be.rejected;
                                const dbProgram = await Program.findOneOrFail(program.id)

                                expect(dbProgram.status).to.eq(Status.ACTIVE)
                                expect(dbProgram.deleted_at).to.be.null
                            });
                        });
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and does not belong to the organization from the program", () => {
                    it("deletes the expected program", async () => {
                        let dbProgram = await Program.findOneOrFail(program.id)

                        expect(dbProgram.status).to.eq(Status.ACTIVE)
                        expect(dbProgram.deleted_at).to.be.null

                        const gqlBool = await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })

                        expect(gqlBool).to.be.true
                        dbProgram = await Program.findOneOrFail(program.id)
                        expect(dbProgram.status).to.eq(Status.INACTIVE)
                        expect(dbProgram.deleted_at).not.to.be.null
                    });
                });

                context("and belongs to the organization from the program", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
                    });

                    context("with a non system program", () => {
                        it("deletes the expected program", async () => {
                            let dbProgram = await Program.findOneOrFail(program.id)

                            expect(dbProgram.status).to.eq(Status.ACTIVE)
                            expect(dbProgram.deleted_at).to.be.null

                            const gqlBool = await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })

                            expect(gqlBool).to.be.true
                            dbProgram = await Program.findOneOrFail(program.id)
                            expect(dbProgram.status).to.eq(Status.INACTIVE)
                            expect(dbProgram.deleted_at).not.to.be.null
                        });

                        context("with the program already deleted", () => {
                            beforeEach(async () => {
                                await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })
                            });

                            it("cannot delete the program", async () => {
                                const gqlBool = await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })

                                expect(gqlBool).to.be.false
                                const dbProgram = await Program.findOneOrFail(program.id)
                                expect(dbProgram.status).to.eq(Status.INACTIVE)
                                expect(dbProgram.deleted_at).not.to.be.null
                            });
                        });
                    });

                    context("with a system program", () => {
                        beforeEach(async () => {
                            program.system = true
                            await connection.manager.save(program);
                        });

                        it("deletes the expected program", async () => {
                            let dbProgram = await Program.findOneOrFail(program.id)

                            expect(dbProgram.status).to.eq(Status.ACTIVE)
                            expect(dbProgram.deleted_at).to.be.null

                            const gqlBool = await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })

                            expect(gqlBool).to.be.true
                            dbProgram = await Program.findOneOrFail(program.id)
                            expect(dbProgram.status).to.eq(Status.INACTIVE)
                            expect(dbProgram.deleted_at).not.to.be.null
                        });

                        context("with the program already deleted", () => {
                            beforeEach(async () => {
                                await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })
                            });

                            it("cannot delete the program", async () => {
                                const gqlBool = await deleteProgram(testClient, program.id, { authorization: JoeAuthToken })

                                expect(gqlBool).to.be.false
                                const dbProgram = await Program.findOneOrFail(program.id)
                                expect(dbProgram.status).to.eq(Status.INACTIVE)
                                expect(dbProgram.deleted_at).not.to.be.null
                            });
                        });
                    });
                });
            });
        });
    });
});

