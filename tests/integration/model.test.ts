import { expect, use } from "chai";
import { Connection } from "typeorm";
import fs from 'fs';
import { resolve } from 'path';
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { JoeAuthToken, JoeAuthWithoutIdToken, BillyAuthToken } from "../utils/testConfig";
import { createAgeRange } from "../factories/ageRange.factory";
import { createGrade } from "../factories/grade.factory";
import { createOrganization } from "../factories/organization.factory";
import { createSubcategory } from "../factories/subcategory.factory";
import { getAgeRange, getGrade, getSubcategory, getAllOrganizations, getPermissions, getOrganizations, switchUser, me, myUsers, getProgram, uploadSchoolsFile } from "../utils/operations/modelOps";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { addUserToOrganizationAndValidate } from "../utils/operations/organizationOps";
import { Model } from "../../src/model";
import { AgeRange } from "../../src/entities/ageRange";
import { Grade } from "../../src/entities/grade";
import { User } from "../../src/entities/user";
import { Permission } from "../../src/entities/permission";
import { Organization } from "../../src/entities/organization";
import { Class } from "../../src/entities/class";
import { School } from "../../src/entities/school";
import { Subcategory } from "../../src/entities/subcategory";
import chaiAsPromised from "chai-as-promised";
import { Program } from "../../src/entities/program";
import { createProgram } from "../factories/program.factory";
import { createSchool } from "../factories/school.factory";
import { ReadStream } from 'fs';
import { queryUploadRoles, uploadRoles } from "../utils/operations/csv/uploadRoles";
import { queryUploadClasses, uploadClasses } from "../utils/operations/csv/uploadClasses";
import { Role } from "../../src/entities/role";
import { before } from "mocha";

use(chaiAsPromised);

describe("model", () => {
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

    describe("switchUser", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            it("raises an error", async () => {
                const fn = () => switchUser(testClient, user.user_id, { authorization: undefined });

                expect(fn()).to.be.rejected;
            });
        });

        context("when user is logged in", () => {
            context("and the user_id is on the account", () => {
                it("returns the expected user", async () => {
                    const gqlRes = await switchUser(testClient, user.user_id, { authorization: JoeAuthToken });
                    const gqlUser = gqlRes.data?.switch_user as User
                    const gqlCookies = gqlRes.extensions?.cookies

                    expect(gqlUser.user_id).to.eq(user.user_id)
                    expect(gqlCookies.user_id?.value).to.eq(user.user_id)
                });
            });

            context("and the user_id is on the account", () => {
                let otherUser: User;

                beforeEach(async () => {
                    otherUser = await createUserBilly(testClient);
                });

                it("raises an error", async () => {
                    const fn = () => switchUser(testClient, otherUser.user_id, { authorization: JoeAuthToken });

                    expect(fn()).to.be.rejected;
                });
            });
        });
    });

    describe("getMyUser", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            context("and the user_id cookie is not provided", () => {
                it("returns null", async () => {
                    const gqlUser = await me(testClient, { authorization: undefined });

                    expect(gqlUser).to.be.null
                });
            });

            context("and the user_id cookie is provided", () => {
                it("returns null", async () => {
                    const gqlUser = await me(testClient, { authorization: undefined }, { user_id: user.user_id });

                    expect(gqlUser).to.be.null
                });
            });
        });

        context("when user is logged in", () => {
            context("and no user_id cookie is provided", () => {
                it("creates and returns the expected user", async () => {
                    const gqlUserWithoutId = await me(testClient, { authorization: JoeAuthWithoutIdToken }, { user_id: user.user_id });
                    const gqlUser = await me(testClient, { authorization: JoeAuthToken }, { user_id: user.user_id });

                    expect(gqlUserWithoutId.user_id).to.eq(gqlUser.user_id)
                });
            });

            context("and the correct user_id cookie is provided", () => {
                it("returns the expected user", async () => {
                    const gqlUser = await me(testClient, { authorization: JoeAuthToken }, { user_id: user.user_id });

                    expect(gqlUser.user_id).to.eq(user.user_id)
                });
            });

            context("and the incorrect user_id cookie is provided", () => {
                let otherUser: User;

                beforeEach(async () => {
                    otherUser = await createUserBilly(testClient);
                });

                it("returns a user based from the token", async () => {
                    const gqlUser = await me(testClient, { authorization: JoeAuthToken }, { user_id: otherUser.user_id });

                    expect(gqlUser).to.not.be.null
                    expect(gqlUser.user_id).to.eq(user.user_id)
                    expect(gqlUser.email).to.eq(user.email)
                });
            });
        });
    });

    describe("myUsers", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            it("raises an error", async () => {
                const fn = () => myUsers(testClient, { authorization: undefined });

                expect(fn()).to.be.rejected;
            });
        });

        context("when user is logged in", () => {
            const userInfo = (user: User) => { return user.user_id }

            it("returns the expected users", async () => {
                const gqlUsers = await myUsers(testClient, { authorization: JoeAuthToken });

                expect(gqlUsers.map(userInfo)).to.deep.eq([user.user_id])
            });
        });
    });

    describe("getOrganizations", () => {
        let user: User;
        let organization: Organization;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
            organization = await createOrganizationAndValidate(testClient, user.user_id);
        });

        context("when user is not logged in", () => {
            it("returns an empty list of organizations", async () => {
                const gqlOrgs = await getAllOrganizations(testClient, { authorization: undefined });

                expect(gqlOrgs).to.be.empty;
            });
        });

        context("when user is logged in", () => {
            const orgInfo = (org: Organization) => { return org.organization_id }
            let otherOrganization: Organization

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
                otherOrganization = await createOrganizationAndValidate(testClient, otherUser.user_id, "Billy's Org");
            });

            context("and the user is not an admin", () => {
                it("raises an error", async () => {
                    const fn = () => getAllOrganizations(testClient, { authorization: BillyAuthToken });

                    expect(fn()).to.be.rejected;
                });
            });

            context("and there is no filter in the organization ids", () => {
                it("returns the expected organizations", async () => {
                    const gqlOrgs = await getAllOrganizations(testClient, { authorization: JoeAuthToken });

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([
                        organization.organization_id,
                        otherOrganization.organization_id
                    ]);
                });
            });

            context("and there is a filter in the organization ids", () => {
                it("returns the expected organizations", async () => {
                    const gqlOrgs = await getOrganizations(
                        testClient,
                        [organization.organization_id],
                        { authorization: JoeAuthToken }
                    );

                    expect(gqlOrgs.map(orgInfo)).to.deep.eq([organization.organization_id]);
                });
            });
        });
    });

    describe("getPermissions", () => {
        let user: User;

        beforeEach(async () => {
            user = await createUserJoe(testClient);
        });

        context("when user is not logged in", () => {
            it("raises an error", async () => {
                const fn = () => getPermissions(testClient, { authorization: undefined });

                expect(fn()).to.be.rejected;
            });
        });

        context("when user is logged in", () => {
            const permissionInfo = (permission: Permission) => { return permission.permission_id }

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
            });

            context("and the user is not an admin", () => {
                it("returns paginated results", async () => {
                    const gqlPermissions = await getPermissions(testClient, { authorization: BillyAuthToken });

                    expect(gqlPermissions?.permissions?.edges).to.not.be.empty
                    expect(gqlPermissions?.permissions?.pageInfo).to.not.be.empty
                    expect(gqlPermissions?.permissions?.total).to.not.be.undefined
                });

                it("returns all the permissions available", async () => {
                    let gqlPermissions = await getPermissions(testClient, { authorization: BillyAuthToken });
                    const dbPermissions = await Permission.find() || []

                    const permissions = gqlPermissions?.permissions?.edges || []
                    let hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                    while (hasNext) {
                        const endCursor = gqlPermissions?.permissions?.pageInfo?.endCursor
                        gqlPermissions = await getPermissions(testClient, { authorization: BillyAuthToken }, endCursor);
                        const morePermissions = gqlPermissions?.permissions?.edges || []
                        hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                        for (const permission of morePermissions) {
                            permissions.push(permission)
                        }
                    }

                    expect(permissions.map(permissionInfo)).to.deep.members(dbPermissions.map(permissionInfo))
                });
            });

            context("and the user is an admin", () => {
                it("returns paginated results", async () => {
                    const gqlPermissions = await getPermissions(testClient, { authorization: JoeAuthToken });

                    expect(gqlPermissions?.permissions?.edges).to.not.be.empty
                    expect(gqlPermissions?.permissions?.pageInfo).to.not.be.empty
                    expect(gqlPermissions?.permissions?.total).to.not.be.undefined
                });

                it("returns all the permissions available", async () => {
                    let gqlPermissions = await getPermissions(testClient, { authorization: JoeAuthToken });
                    const dbPermissions = await Permission.find() || []

                    const permissions = gqlPermissions?.permissions?.edges || []
                    let hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                    while (hasNext) {
                        const endCursor = gqlPermissions?.permissions?.pageInfo?.endCursor
                        gqlPermissions = await getPermissions(testClient, { authorization: JoeAuthToken }, endCursor);
                        const morePermissions = gqlPermissions?.permissions?.edges || []
                        hasNext = gqlPermissions?.permissions?.pageInfo?.hasNextPage as boolean

                        for (const permission of morePermissions) {
                            permissions.push(permission)
                        }
                    }

                    expect(permissions.map(permissionInfo)).to.deep.members(dbPermissions.map(permissionInfo))
                });
            });
        });
    });

    describe("getAgeRange", () => {
        let user: User;
        let ageRange: AgeRange;
        let organizationId: string;

        const ageRangeInfo = (ageRange: AgeRange) => {
            return {
                id: ageRange.id,
                name: ageRange.name,
                high_value: ageRange.high_value,
                high_value_unit: ageRange.high_value_unit,
                low_value: ageRange.low_value,
                low_value_unit: ageRange.low_value_unit,
                system: ageRange.system,
            }
        }

        beforeEach(async () => {
            user = await createUserJoe(testClient);
            const org = createOrganization(user)
            await connection.manager.save(org)
            organizationId = org.organization_id
            ageRange = createAgeRange(org)
            await connection.manager.save(ageRange)
        });

        context("when user is not logged in", () => {
            it("returns no age range", async () => {
                const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: undefined });

                expect(gqlAgeRange).to.be.null;
            });
        });

        context("when user is logged in", () => {
            let otherUserId: string;

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
                otherUserId = otherUser.user_id
            });

            context("and the user is not an admin", () => {
                context("and it belongs to the organization from the age range", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: BillyAuthToken });

                        expect(gqlAgeRange).not.to.be.null;
                        expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(ageRangeInfo(ageRange))
                    });
                });

                context("and it does not belongs to the organization from the age range", () => {
                    it("returns no age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: BillyAuthToken });

                        expect(gqlAgeRange).to.be.null;
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and it belongs to the organization from the age range", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, user.user_id, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: JoeAuthToken });

                        expect(gqlAgeRange).not.to.be.null;
                        expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(ageRangeInfo(ageRange))
                    });
                });

                context("and it does not belongs to the organization from the age range", () => {
                    it("returns the expected age range", async () => {
                        const gqlAgeRange = await getAgeRange(testClient, ageRange.id, { authorization: JoeAuthToken });

                        expect(gqlAgeRange).not.to.be.null;
                        expect(ageRangeInfo(gqlAgeRange)).to.deep.eq(ageRangeInfo(ageRange))
                    });
                });
            });
        });
    });

    describe("getGrade", () => {
        let user: User;
        let userId: string;
        let otherUserId: string;
        let organization: Organization;
        let organizationId: string;
        let grade: Grade;

        let gradeDetails: any;

        const gradeInfo = async (grade: Grade) => {
            return {
                name: grade.name,
                progress_from_grade_id: (await grade.progress_from_grade)?.id,
                progress_to_grade_id: (await grade.progress_to_grade)?.id,
                system: grade.system,
            }
        }

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            otherUserId = orgOwner.user_id
            user = await createUserBilly(testClient);
            userId = user.user_id
            organization = await createOrganizationAndValidate(testClient, orgOwner.user_id);
            organizationId = organization.organization_id
            const progressFromGrade = createGrade(organization)
            await progressFromGrade.save()
            const progressToGrade = createGrade(organization)
            await progressToGrade.save()
            grade = createGrade(organization, progressFromGrade, progressToGrade)
            await grade.save()
            gradeDetails = await gradeInfo(grade)
        });

        context("when user is not logged in", () => {
            it("returns no age range", async () => {
                const gqlGrade = await getGrade(testClient, grade.id, { authorization: undefined });

                expect(gqlGrade).to.be.null;
            });
        });

        context("when user is logged in", () => {
            context("and the user is not an admin", () => {
                context("and it belongs to the organization from the grade", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected grade", async () => {
                        const gqlGrade = await getGrade(testClient, grade.id, { authorization: BillyAuthToken });

                        expect(gqlGrade).not.to.be.null;
                        const gqlGradeDetails = await gradeInfo(gqlGrade)
                        expect(gqlGradeDetails).to.deep.eq(gradeDetails)
                    });
                });

                context("and it does not belongs to the organization from the grade", () => {
                    it("returns no grade", async () => {
                        const gqlGrade = await getGrade(testClient, grade.id, { authorization: BillyAuthToken });

                        expect(gqlGrade).to.be.null;
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and it belongs to the organization from the grade", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected grade", async () => {
                        const gqlGrade = await getGrade(testClient, grade.id, { authorization: JoeAuthToken });

                        expect(gqlGrade).not.to.be.null;
                        const gqlGradeDetails = await gradeInfo(gqlGrade)
                        expect(gqlGradeDetails).to.deep.eq(gradeDetails)
                    });
                });

                context("and it does not belongs to the organization from the grade", () => {
                    it("returns the expected grade", async () => {
                        const gqlGrade = await getGrade(testClient, grade.id, { authorization: JoeAuthToken });

                        expect(gqlGrade).not.to.be.null;
                        const gqlGradeDetails = await gradeInfo(gqlGrade)
                        expect(gqlGradeDetails).to.deep.eq(gradeDetails)
                    });
                });
            });
        });
    });

    describe("getSubcategory", () => {
        let user: User;
        let subcategory: Subcategory;
        let organizationId: string;

        const subcategoryInfo = (subcategory: Subcategory) => {
            return {
                id: subcategory.id,
                name: subcategory.name,
                system: subcategory.system,
            }
        }

        beforeEach(async () => {
            user = await createUserJoe(testClient);
            const org = createOrganization(user)
            await connection.manager.save(org)
            organizationId = org.organization_id
            subcategory = createSubcategory(org)
            await connection.manager.save(subcategory)
        });

        context("when user is not logged in", () => {
            it("returns no subcategory", async () => {
                const gqlSubcategory = await getSubcategory(testClient, subcategory.id, { authorization: undefined });

                expect(gqlSubcategory).to.be.null;
            });
        });

        context("when user is logged in", () => {
            let otherUserId: string;

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
                otherUserId = otherUser.user_id
            });

            context("and the user is not an admin", () => {
                context("and it belongs to the organization from the subcategory", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected subcategory", async () => {
                        const gqlSubcategory = await getSubcategory(testClient, subcategory.id, { authorization: BillyAuthToken });

                        expect(gqlSubcategory).not.to.be.null;
                        expect(subcategoryInfo(gqlSubcategory)).to.deep.eq(subcategoryInfo(subcategory))
                    });
                });

                context("and it does not belongs to the organization from the subcategory", () => {
                    it("returns no subcategory", async () => {
                        const gqlSubcategory = await getSubcategory(testClient, subcategory.id, { authorization: BillyAuthToken });

                        expect(gqlSubcategory).to.be.null;
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and it belongs to the organization from the subcategory", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, user.user_id, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected subcategory", async () => {
                        const gqlSubcategory = await getSubcategory(testClient, subcategory.id, { authorization: JoeAuthToken });

                        expect(gqlSubcategory).not.to.be.null;
                        expect(subcategoryInfo(gqlSubcategory)).to.deep.eq(subcategoryInfo(subcategory))
                    });
                });

                context("and it does not belongs to the organization from the subcategory", () => {
                    it("returns the expected subcategory", async () => {
                        const gqlSubcategory = await getSubcategory(testClient, subcategory.id, { authorization: JoeAuthToken });

                        expect(gqlSubcategory).not.to.be.null;
                        expect(subcategoryInfo(gqlSubcategory)).to.deep.eq(subcategoryInfo(subcategory))
                    });
                });
            });
        });
    });

    describe("getProgram", () => {
        let user: User;
        let program: Program;
        let organizationId: string;

        const programInfo = (program: Program) => {
            return {
                id: program.id,
                name: program.name,
                system: program.system,
            }
        }

        beforeEach(async () => {
            user = await createUserJoe(testClient);
            const org = createOrganization(user)
            await connection.manager.save(org)
            organizationId = org.organization_id
            program = createProgram(org)
            await connection.manager.save(program)
        });

        context("when user is not logged in", () => {
            it("returns no program", async () => {
                const gqlProgram = await getProgram(testClient, program.id, { authorization: undefined });

                expect(gqlProgram).to.be.null;
            });
        });

        context("when user is logged in", () => {
            let otherUserId: string;

            beforeEach(async () => {
                const otherUser = await createUserBilly(testClient);
                otherUserId = otherUser.user_id
            });

            context("and the user is not an admin", () => {
                context("and it belongs to the organization from the program", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, otherUserId, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected program", async () => {
                        const gqlProgram = await getProgram(testClient, program.id, { authorization: BillyAuthToken });

                        expect(gqlProgram).not.to.be.null;
                        expect(programInfo(gqlProgram)).to.deep.eq(programInfo(program))
                    });
                });

                context("and it does not belongs to the organization from the program", () => {
                    it("returns no program", async () => {
                        const gqlProgram = await getProgram(testClient, program.id, { authorization: BillyAuthToken });

                        expect(gqlProgram).to.be.null;
                    });
                });
            });

            context("and the user is an admin", () => {
                context("and it belongs to the organization from the program", () => {
                    beforeEach(async () => {
                        await addUserToOrganizationAndValidate(testClient, user.user_id, organizationId, { authorization: JoeAuthToken });
                    });

                    it("returns the expected program", async () => {
                        const gqlProgram = await getProgram(testClient, program.id, { authorization: JoeAuthToken });

                        expect(gqlProgram).not.to.be.null;
                        expect(programInfo(gqlProgram)).to.deep.eq(programInfo(program))
                    });
                });

                context("and it does not belongs to the organization from the program", () => {
                    it("returns the expected program", async () => {
                        const gqlProgram = await getProgram(testClient, program.id, { authorization: JoeAuthToken });

                        expect(gqlProgram).not.to.be.null;
                        expect(programInfo(gqlProgram)).to.deep.eq(programInfo(program))
                    });
                });
            });
        });
    });

    describe("uploadRolesFromCSV", () => {
        let file: ReadStream;
        const mimetype = 'text/csv';
        const encoding = '7bit';
        const filename = 'rolesExample.csv';

        context("when operation is not a mutation", () => {
            it("should throw an error", async () => {
                file = fs.createReadStream(resolve(`tests/fixtures/${filename}`));

                const fn = async () => await queryUploadRoles(testClient, file, filename, mimetype, encoding);
                expect(fn()).to.be.rejected;

                const rolesCreated = await Role.count({ where: { system_role: false } });
                expect(rolesCreated).eq(0);
            });
        });

        context("when file data is not correct", () => {
            it("should throw an error", async () => {
                file = fs.createReadStream(resolve(`tests/fixtures/${filename}`));

                const fn = async () => await uploadRoles(testClient, file, filename, mimetype, encoding);
                expect(fn()).to.be.rejected;

                const rolesCreated = await Role.count({ where: { system_role: false } });
                expect(rolesCreated).eq(0);
            });
        });

        context("when file data is correct", () => {
            beforeEach(async () => {
                for (let i = 1; i <= 4; i += 1) {
                    let org = await createOrganization();
                    org.organization_name = `Company ${i}`;
                    await connection.manager.save(org);
                }
            });

            it("should create roles", async () => {
                file = fs.createReadStream(resolve(`tests/fixtures/${filename}`));

                const result = await uploadRoles(testClient, file, filename, mimetype, encoding);
                expect(result.filename).eq(filename);
                expect(result.mimetype).eq(mimetype);
                expect(result.encoding).eq(encoding);

                const rolesCreated = await Role.count({ where: { system_role: false } });
                expect(rolesCreated).gt(0);
            });
        });
    });

    describe("uploadClassesFromCSV", () => {
        let file: ReadStream;
        const mimetype = 'text/csv';
        const encoding = '7bit';
        let filename = 'classes-bad.csv';

        context("when operation is not a mutation", () => {
            it("should throw an error", async () => {
                file = fs.createReadStream(resolve(`tests/fixtures/${filename}`));

                const fn = async () => await queryUploadClasses(testClient, file, filename, mimetype, encoding);
                expect(fn()).to.be.rejected;

                const classesCreated = await Class.count();
                expect(classesCreated).eq(0);
            });
        });

        context("when file data is not correct", () => {
            it("should throw an error", async () => {
                file = fs.createReadStream(resolve(`tests/fixtures/${filename}`));

                const fn = async () => await uploadClasses(testClient, file, filename, mimetype, encoding);
                expect(fn()).to.be.rejected;

                const classesreated = await Class.count();
                expect(classesreated).eq(0);
            });
        });

        context("when file data is correct", () => {
            let expectedOrg: Organization
            let expectedProg: Program
            let expectedSchool: School
                
            beforeEach(async ()=>{
                filename = "classes.csv";
                file = fs.createReadStream(resolve(`tests/fixtures/${filename}`));
                expectedOrg = createOrganization()
                expectedOrg.organization_name = "my-org"
                await connection.manager.save(expectedOrg)

                expectedProg = createProgram(expectedOrg)
                expectedProg.name = "outdoor activities"
                await connection.manager.save(expectedProg)

                expectedSchool = createSchool(expectedOrg, 'test-school')
                await connection.manager.save(expectedSchool)    
            });
            
            it("should create classes", async () => {
                const result = await uploadClasses(testClient, file, filename, mimetype, encoding);
                const dbClass = await Class.findOneOrFail({where:{class_name:"class1", organization:expectedOrg}});
                const schools = await dbClass.schools || []
                const programs = await dbClass.programs || []

                expect(result.filename).eq(filename);
                expect(result.mimetype).eq(mimetype);
                expect(result.encoding).eq(encoding);
                expect(schools.length).to.equal(1)
                expect(programs.length).to.equal(1)
            });
        });
    });
});