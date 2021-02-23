import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { User } from "../../src/entities/user";
import { School } from "../../src/entities/school";
import { Status } from "../../src/entities/status";
import { createOrganizationAndValidate } from "../utils/operations/userOps";
import { createDefaultRoles } from "../utils/operations/modelOps";
import { createUserJoe, createUserBilly } from "../utils/testEntities";
import { getSchoolMembershipsForOrganizationMembership, addRoleToOrganizationMembership } from "../utils/operations/organizationMembershipOps";
import { addUserToOrganizationAndValidate, createSchool, createClass, createRole,  inviteUser, editMembership, deleteOrganization } from "../utils/operations/organizationOps";
import { grantPermission } from "../utils/operations/roleOps";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { SchoolMembership } from "../../src/entities/schoolMembership";
import { JoeAuthToken, BillyAuthToken } from "../utils/testConfig";
import { Organization } from "../../src/entities/organization";
import { OrganizationMembership } from "../../src/entities/organizationMembership";
import { OrganizationOwnership } from "../../src/entities/organizationOwnership";
import { PermissionName } from "../../src/permissions/permissionNames";
import { Role } from "../../src/entities/role";
import { UserPermissions } from "../../src/permissions/userPermissions";
import chaiAsPromised from "chai-as-promised";
import chai from "chai"
import { isRequiredArgument } from "graphql";
chai.use(chaiAsPromised);

describe("organization", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let user: User;
    let originalAdmins: string[];
    let organization: Organization;
    let role: Role;

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
        await connection?.synchronize(true);
        await createDefaultRoles(testClient, { authorization: JoeAuthToken });
    });

    describe("findOrCreateUser", async () => {
        beforeEach(async () => {
            user = await createUserJoe(testClient);
            organization = await createOrganizationAndValidate(testClient, user.user_id);
        });

        it("the organization status by default is active", async () => {
            expect(organization.status).to.eq(Status.ACTIVE)
        });

        it("should assign the old user to the exsting user", async () => {
            let oldUser: User
            let email = user.email ?? ""
            oldUser = await organization["findOrCreateUser"](email, undefined, user.given_name, user.family_name)
            expect(oldUser).to.exist
            expect(oldUser.user_id).to.equal(user.user_id)

        });
        it("should assign the new user to a new user with an email", async () => {
            let newUser: User
            newUser = await organization["findOrCreateUser"]("bob@nowhere.com",undefined, "Bob", "Smith")
            expect(newUser).to.exist
            expect(newUser.email).to.equal("bob@nowhere.com")
        });

        it("should assign the new user to a new user with a phone number", async () => {
            let newUser: User
            newUser = await organization["findOrCreateUser"](undefined, "+44207344141","Bob", "Smith")
            expect(newUser).to.exist
            expect(newUser.phone).to.equal("+44207344141")
        });

    });

    describe("membershipOrganization", async () => {
        context("we have a user and an organization", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            beforeEach(async () => {
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganizationAndValidate(testClient, user.user_id);
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

    describe("createClass", async () => {
        let userId: string;
        let organizationId: string;
        let classInfo = (cls : any) => { return cls.class_id }


        beforeEach(async () => {
            user = await createUserJoe(testClient);
            userId = user.user_id
            organization = await createOrganizationAndValidate(testClient, user.user_id);
            organizationId = organization.organization_id
        });

        context("when class name is empty", () => {
            it("does not create the class", async () => {
                const cls = await createClass(testClient, organizationId, "", { authorization: JoeAuthToken });

                expect(cls).to.be.null
                const dbOrg = await Organization.findOneOrFail(organizationId);
                const orgClasses = await dbOrg.classes || []
                expect(orgClasses).to.be.empty

            });
        });

        context("when class name is not empty", () => {
            it("creates the class", async () => {
                const cls = await createClass(testClient, organizationId, "Some Class 1", { authorization: JoeAuthToken });

                expect(cls).not.to.be.null
                const dbOrg = await Organization.findOneOrFail(organizationId);
                const orgClasses = await dbOrg.classes || []
                expect(orgClasses.map(classInfo)).to.deep.eq([cls.class_id])
                expect(cls.status).to.eq(Status.ACTIVE)
            });

            context("and the class name is duplicated in the same organization", () => {
                let oldClass : any;

                beforeEach(async () => {
                    oldClass = await createClass(testClient, organizationId, "Some Class 1", { authorization: JoeAuthToken });
                });

                it("does not create the class", async () => {
                    const cls = await createClass(testClient, organizationId, "Some Class 1", { authorization: JoeAuthToken });

                    expect(cls).to.be.null
                    const dbOrg = await Organization.findOneOrFail(organizationId);
                    const orgClasses = await dbOrg.classes || []
                    expect(orgClasses.map(classInfo)).to.deep.eq([oldClass.class_id])
                });
            });

            context("and the class name is duplicated in different organizations", () => {
                let otherClass : any;

                beforeEach(async () => {
                    const otherUser = await createUserBilly(testClient);
                    const otherUserId = otherUser.user_id
                    const otherOrganization = await createOrganizationAndValidate(testClient, otherUserId, "Other Organization");
                    const otherOrganizationId = otherOrganization.organization_id
                    otherClass = await createClass(testClient, otherOrganizationId, "Some Class 1", { authorization: BillyAuthToken });
                });

                it("creates the class", async () => {
                    const cls = await createClass(testClient, organizationId, "Some Class 1", { authorization: JoeAuthToken });

                    expect(cls).not.to.be.null
                    const dbOrg = await Organization.findOneOrFail(organizationId);
                    const orgClasses = await dbOrg.classes || []
                    expect(orgClasses.map(classInfo)).to.deep.eq([cls.class_id])
                    expect(cls.class_id).to.not.eq(otherClass.class_id)
                    expect(cls.class_name).to.eq(otherClass.class_name)
                    expect(cls.status).to.eq(Status.ACTIVE)
                });

                context("and the organization is marked as inactive", () => {
                    beforeEach(async () => {
                        await deleteOrganization(testClient, organization.organization_id, { authorization: JoeAuthToken });
                    });

                    it("fails to create class in the organization", async () => {
                        const cls = await createClass(testClient, organizationId, "", { authorization: JoeAuthToken });

                        expect(cls).to.be.null
                        const dbOrg = await Organization.findOneOrFail(organizationId);
                        const orgClasses = await dbOrg.classes || []
                        expect(orgClasses).to.be.empty
                    });
                });
            });
        });
    })

    describe("createSchool", async () => {
        let userId: string;
        let organizationId: string;
        let schoolInfo = (school : any) => { return school.school_id }


        beforeEach(async () => {
            user = await createUserJoe(testClient);
            userId = user.user_id
            organization = await createOrganizationAndValidate(testClient, user.user_id);
            organizationId = organization.organization_id
        });

        context("when school name is empty", () => {
            it("does not create the school", async () => {
                const school = await createSchool(testClient, organizationId, "", { authorization: JoeAuthToken });

                expect(school).to.be.null
                const dbSchool = await Organization.findOneOrFail(organizationId);
                const orgSchools = await dbSchool.schools || []
                expect(orgSchools).to.be.empty

            });
        });

        context("when school name is not empty", () => {
            it("creates the school", async () => {
                const school = await createSchool(testClient, organizationId, "some school 1", { authorization: JoeAuthToken });

                expect(school).not.to.be.null
                const dbSchool = await Organization.findOneOrFail(organizationId);
                const orgSchools = await dbSchool.schools || []
                expect(orgSchools.map(schoolInfo)).to.deep.eq([school.school_id])

            });

            context("and the school name is duplicated in the same organization", () => {
                let oldSchool : any;

                beforeEach(async () => {
                    oldSchool = await createSchool(testClient, organizationId, "some school 1", { authorization: JoeAuthToken });
                });

                it("does not create the school", async () => {
                    const school = await createSchool(testClient, organizationId, "some school 1", { authorization: JoeAuthToken });

                    expect(school).to.be.null
                    const dbSchool = await Organization.findOneOrFail(organizationId);
                    const orgSchools = await dbSchool.schools || []
                    expect(orgSchools.map(schoolInfo)).to.deep.eq([oldSchool.school_id])

                });
            });

            context("and the school name is duplicated in different organizations", () => {
                let otherSchool : any;

                beforeEach(async () => {
                    const otherUser = await createUserBilly(testClient);
                    const otherUserId = otherUser.user_id
                    const otherOrganization = await createOrganizationAndValidate(testClient, otherUserId, "Other Organization");
                    const otherOrganizationId = otherOrganization.organization_id
                    otherSchool = await createSchool(testClient, otherOrganizationId, "some school 1", { authorization: BillyAuthToken });
                });

                it("creates the school", async () => {
                    const school = await createSchool(testClient, organizationId, "some school 1", { authorization: JoeAuthToken });

                    expect(school).not.to.be.null
                    const dbSchool = await Organization.findOneOrFail(organizationId);
                    const orgSchools = await dbSchool.schools || []
                    expect(orgSchools.map(schoolInfo)).to.deep.eq([school.school_id])
                    expect(school.school_id).to.not.eq(otherSchool.school_id)
                    expect(school.school_name).to.eq(otherSchool.school_name)

                });

                context("and the organization is marked as inactive", () => {
                    beforeEach(async () => {
                        await deleteOrganization(testClient, organization.organization_id, { authorization: JoeAuthToken });
                    });

                    it("fails to create school in the organization", async () => {
                        const school = await createSchool(testClient, organizationId, "some school 1", { authorization: JoeAuthToken });

                        expect(school).to.be.null
                        const dbSchool = await Organization.findOneOrFail(organizationId);
                        const orgSchools = await dbSchool.schools || []
                        expect(orgSchools).to.be.empty
                    });
                });
            });
        });
    })

    describe("membershipSchools", async () => {
        context("when user is a member of an organization", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            beforeEach(async () => {
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganizationAndValidate(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
                schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
                await addUserToOrganizationAndValidate(testClient, userId, organizationId, { authorization: JoeAuthToken });
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
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganizationAndValidate(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await Role.findOneOrFail({ where: { role_name: 'Student' } })
                roleId = role.role_id
                schoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
            });

            it("should create the user, make the user a member of the organization and set the school in the schools membership for the user", async () => {

                let object = await organization["_setMembership"](undefined, "+44207344141", "Bob", "Smith", undefined, "Bunter", new Array(roleId), Array(schoolId), new Array(roleId))

                let newUser = object.user
                let membership = object.membership
                let schoolmemberships = object.schoolMemberships

                expect(newUser).to.exist
                expect(newUser.phone).to.equal("+44207344141")

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)

            });
            it("should create the user, make the user a member of the organization and set the school in the schools membership for the user", async () => {

                let object = await organization["_setMembership"]("bob@nowhere.com", undefined, "Bob", "Smith", undefined, "Bunter", new Array(roleId), Array(schoolId), new Array(roleId))

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
                let object = await organization["_setMembership"](email, undefined, given, family, undefined, "Bunter", new Array(roleId), Array(schoolId), new Array(roleId))

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
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganizationAndValidate(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
                roleId = role.role_id
                oldSchoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
                schoolId = (await createSchool(testClient, organizationId, "school 2", { authorization: JoeAuthToken })).school_id;
                await addUserToSchool(testClient, userId, oldSchoolId, { authorization: JoeAuthToken });
            });
            it("should find the user, make the user a member of the organization and set the school in the schools membership for the user", async () => {
                let email = user.email
                let given = user.given_name
                let family = user.family_name
                let object = await organization["_setMembership"](email, undefined, given, family, undefined, "Bunter", new Array(roleId), Array(schoolId), new Array(roleId))

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
            it("should attempt to assign a role for one organizion to another and not succeed", async () => {
                let user2 = await createUserBilly(testClient);
                let userId2 = user2.user_id
                let organization2 = await createOrganizationAndValidate(testClient, userId2, "otherOrgName", BillyAuthToken);
                let organizationId2 = organization2.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
                roleId = role.role_id
                let role2 = await createRole(testClient, organizationId2, "student", "student role", BillyAuthToken);
                let role2id = role2.role_id
                let email = user.email
                let given = user.given_name
                let family = user.family_name
                try{
                    let object = await organization["_setMembership"](email, undefined, given, family, undefined, "Bunter", [roleId,role2id], Array(schoolId), new Array(roleId))
                    expect(false).true
                }
                catch(e){
                    expect(e).to.exist
                }
            });
        });

    });

    describe("inviteUser", async () => {
        context("We have an email or phone, profile_name, given_name, family_name, date_of_birth, organization_role_ids, school_ids and school_role_ids", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            let oldSchoolId: string;
            let roleId: string

            beforeEach(async () => {
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganizationAndValidate(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await Role.findOneOrFail({ where: { role_name: 'Student' } })
                roleId = role.role_id
                oldSchoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
                schoolId = (await createSchool(testClient, organizationId, "school 2", { authorization: JoeAuthToken })).school_id;
                await addUserToSchool(testClient, userId, oldSchoolId, { authorization: JoeAuthToken});
            });

            it("creates the user when email provided", async () => {
                let email = "bob@nowhere.com"
                let phone = undefined
                let given = "Bob"
                let family = "Smith"
                let dateOfBirth = "02-1978"
                let gqlresult = await inviteUser( testClient, organizationId, email, phone, given, family, dateOfBirth, "Bunter", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult?.user
                let membership = gqlresult?.membership
                let schoolmemberships = gqlresult?.schoolMemberships

                expect(newUser).to.exist
                expect(newUser?.email).to.equal(email)
                expect(newUser?.date_of_birth).to.equal(dateOfBirth)
                expect(newUser?.username).to.equal("Bunter")


                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser?.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)


                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser?.user_id)

            });

            it("creates the user when no lowercase email provided", async () => {
                const expectedEmail = "bob.dylan@nowhere.com"
                let email = "Bob.Dylan@NOWHERE.com"
                let phone = undefined
                let given = "Bob"
                let family = "Smith"
                let dateOfBirth = "2-1978"
                let gqlresult = await inviteUser( testClient, organizationId, email, phone, given, family, dateOfBirth, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult?.user
                let membership = gqlresult?.membership
                let schoolmemberships = gqlresult?.schoolMemberships

                expect(newUser).to.exist
                expect(newUser?.email).to.equal(expectedEmail)
                expect(newUser?.date_of_birth).to.equal("02-1978")
                expect(newUser?.username).to.equal("Buster")

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser?.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
                

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser?.user_id)
                
            });

            it("creates the user when email provided as phone", async () => {
                let email = undefined
                let phone = "bob.dylan@nowhere.com"
                let given = "Bob"
                let family = "Smith"
                let dateOfBirth = "21-1978"
                let gqlresult = await inviteUser( testClient, organizationId, email, phone, given, family, dateOfBirth, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult?.user
                let membership = gqlresult?.membership
                let schoolmemberships = gqlresult?.schoolMemberships

                expect(newUser).to.exist
                
                expect(newUser.email).to.eq(phone)
                expect(newUser.phone).to.be.null
                expect(newUser.date_of_birth).to.be.null
                expect(newUser.username).to.equal("Buster")
                
                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser?.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
                
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser?.user_id)
                
            });

            it("creates the user when phone provided", async () => {
                let email = undefined
                let phone = "+44207344141"
                let given = "Bob"
                let family = "Smith"
                let gqlresult = await inviteUser( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult?.user
                let membership = gqlresult?.membership
                let schoolmemberships = gqlresult?.schoolMemberships

                expect(newUser).to.exist
                expect(newUser.phone).to.equal(phone)
                expect(newUser?.username).to.equal("Buster")

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser?.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
                

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser?.user_id)
                
            });

            it("creates the user when phone provided as email", async () => {
                let email = "+44207344141"
                let phone = undefined
                let given = "Bob"
                let family = "Smith"
                let gqlresult = await inviteUser( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult?.user
                let membership = gqlresult?.membership
                let schoolmemberships = gqlresult?.schoolMemberships

                expect(newUser).to.exist
                expect(newUser.email).to.be.null
                expect(newUser.phone).to.eq(email)
                
                expect(schoolmemberships).to.exist         
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser?.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)
                
               
                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser?.user_id)
                
            });


            context("and the organization is marked as inactive", () => {
                beforeEach(async () => {
                    await deleteOrganization(testClient, organization.organization_id, { authorization: JoeAuthToken });
                });

                it("fails to invite user to the organization", async () => {
                    let email = "bob@nowhere.com"
                    let phone = undefined
                    let given = "Bob"
                    let family = "Smith"
                    let gqlresult = await inviteUser( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                    expect(gqlresult).to.be.null

                    const dbOrganization = await Organization.findOneOrFail({ where: { organization_id: organizationId } });
                    const organizationMemberships = await dbOrganization.memberships;
                    const dbOrganizationMembership = await OrganizationMembership.findOneOrFail({ where: { organization_id: organizationId, user_id: userId } });

                    expect(organizationMemberships).to.deep.include(dbOrganizationMembership);
                });
            });
        });
    });
    describe("editMemberships", async () => {
        context("We have an email or phone, given_name, family_name, organization_role_ids, school_ids and school_role_ids", () => {
            let userId: string;
            let organizationId: string;
            let schoolId: string;
            let oldSchoolId: string;
            let roleId: string
            beforeEach(async () => {
                user = await createUserJoe(testClient);
                userId = user.user_id
                organization = await createOrganizationAndValidate(testClient, user.user_id);
                organizationId = organization.organization_id
                role = await createRole(testClient, organization.organization_id, "student");
                roleId = role.role_id
                oldSchoolId = (await createSchool(testClient, organizationId, "school 1", { authorization: JoeAuthToken })).school_id;
                schoolId = (await createSchool(testClient, organizationId, "school 2", { authorization: JoeAuthToken })).school_id;
                await addUserToSchool(testClient, userId, oldSchoolId, { authorization: JoeAuthToken });
            });

            it("edits user when email provided", async () => {
                let email = "bob@nowhere.com"
                let phone = undefined
                let given = "Bob"
                let family = "Smith"
                let gqlresult = await editMembership( testClient, organizationId, email, phone, given, family, undefined, "Buster" ,new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult.user
                let membership = gqlresult.membership
                let schoolmemberships = gqlresult.schoolMemberships
                expect(newUser).to.exist
                expect(newUser.email).to.equal(email)

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)
            });

            it("edits user when email provided as phone", async () => {
                let email = undefined
                let phone = "bob.dylan@nowhere.com"
                let given = "Bob"
                let family = "Smith"
                let gqlresult = await editMembership( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult.user
                let membership = gqlresult.membership
                let schoolmemberships = gqlresult.schoolMemberships
                expect(newUser).to.exist
                expect(newUser.email).to.eq(phone)
                expect(newUser.phone).to.be.null

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)
            });

            it("edits user when email provided", async () => {
                let email = "bob@nowhere.com"
                let phone = undefined
                let given = "Bob"
                let family = "Smith"
                let gqlresult = await editMembership( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult.user
                let membership = gqlresult.membership
                let schoolmemberships = gqlresult.schoolMemberships
                expect(newUser).to.exist
                expect(newUser.email).to.equal(email)

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)
            });

            it("edits user when phone provided", async () => {
                let email = undefined
                let phone = "+44207344141"
                let given = "Bob"
                let family = "Smith"
                let gqlresult = await editMembership( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult.user
                let membership = gqlresult.membership
                let schoolmemberships = gqlresult.schoolMemberships
                expect(newUser).to.exist
                expect(newUser.phone).to.equal(phone)

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)
            });

            it("edits user when phone provided as email", async () => {
                let email ="+44207344141"
                let phone = undefined
                let given = "Bob"
                let family = "Smith"
                let gqlresult = await editMembership( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                let newUser = gqlresult.user
                let membership = gqlresult.membership
                let schoolmemberships = gqlresult.schoolMemberships
                expect(newUser).to.exist
                expect(newUser.email).to.be.null
                expect(newUser.phone).to.eq(email)

                expect(schoolmemberships).to.exist
                expect(schoolmemberships.length).to.equal(1)
                expect(schoolmemberships[0].user_id).to.equal(newUser.user_id)
                expect(schoolmemberships[0].school_id).to.equal(schoolId)

                expect(membership).to.exist
                expect(membership.organization_id).to.equal(organizationId)
                expect(membership.user_id).to.equal(newUser.user_id)
            });

            context("and the organization is marked as inactive", () => {
                beforeEach(async () => {
                    await deleteOrganization(testClient, organization.organization_id, { authorization: JoeAuthToken });
                });

                it("fails to edit membership on the organization", async () => {
                    let email = undefined
                    let phone = "+44207344141"
                    let given = "Bob"
                    let family = "Smith"
                    let gqlresult = await editMembership( testClient, organizationId, email, phone, given, family, undefined, "Buster", new Array(roleId), Array(schoolId), new Array(roleId), { authorization: JoeAuthToken })
                    expect(gqlresult).to.be.null
                });
            });
        });
    });

    describe("delete", () => {
        let user: User;
        let organization : Organization;

        beforeEach(async () => {
            const orgOwner = await createUserJoe(testClient);
            user = await createUserBilly(testClient);
            organization = await createOrganizationAndValidate(testClient, orgOwner.user_id);
            const organizationId = organization?.organization_id
            await addUserToOrganizationAndValidate(testClient, user.user_id, organization.organization_id, { authorization: JoeAuthToken });
            const school = await createSchool(testClient, organizationId, "school", { authorization: JoeAuthToken });
        });

        context("when not authenticated", () => {
            it("fails to delete the organization", async () => {
                const fn = () => deleteOrganization(testClient, organization.organization_id, { authorization: undefined });
                expect(fn()).to.be.rejected;
                const dbOrganization = await Organization.findOneOrFail(organization.organization_id);
                expect(dbOrganization.status).to.eq(Status.ACTIVE);
                expect(dbOrganization.deleted_at).to.be.null;
            });
        });

        context("when authenticated", () => {
            context("and the user does not have delete organization permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("fails to delete the organization", async () => {
                    const fn = () => deleteOrganization(testClient, organization.organization_id, { authorization: BillyAuthToken });
                    expect(fn()).to.be.rejected;
                    const dbOrganization = await Organization.findOneOrFail(organization.organization_id);
                    expect(dbOrganization.status).to.eq(Status.ACTIVE);
                    expect(dbOrganization.deleted_at).to.be.null;
                });
            });

            context("and the user has all the permissions", () => {
                beforeEach(async () => {
                    const role = await createRole(testClient, organization.organization_id);
                    await grantPermission(testClient, role.role_id, PermissionName.delete_organization_10440, { authorization: JoeAuthToken });
                    await addRoleToOrganizationMembership(testClient, user.user_id, organization.organization_id, role.role_id);
                });

                it("deletes the organization", async () => {
                    const gqlOrganization = await deleteOrganization(testClient, organization.organization_id, { authorization: BillyAuthToken });
                    expect(gqlOrganization).to.be.true;
                    const dbOrganization = await Organization.findOneOrFail(organization.organization_id);
                    expect(dbOrganization.status).to.eq(Status.INACTIVE);
                    expect(dbOrganization.deleted_at).not.to.be.null;
                });

                it("deletes the organization memberships", async () => {
                    const gqlOrganization = await deleteOrganization(testClient, organization.organization_id, { authorization: BillyAuthToken });
                    expect(gqlOrganization).to.be.true;
                    const dbOrganization = await Organization.findOneOrFail(organization.organization_id);
                    const dbOrganizationMemberships = await OrganizationMembership.find({ where: { organization_id: organization.organization_id } });
                    expect(dbOrganizationMemberships).to.satisfy((memberships : OrganizationMembership[]) => {
                        return memberships.every(membership => membership.status === Status.INACTIVE)
                    });
                });

                it("deletes the organization schools", async () => {
                    const gqlOrganization = await deleteOrganization(testClient, organization.organization_id, { authorization: BillyAuthToken });
                    expect(gqlOrganization).to.be.true;
                    const dbOrganization = await Organization.findOneOrFail(organization.organization_id);
                    const dbSchools = await dbOrganization.schools || []

                    expect(dbSchools).to.satisfy((schools : School[]) => {
                        return schools.every(school => school.status === Status.INACTIVE)
                    });
                });

                it("deletes the organization ownership", async () => {
                    const gqlOrganization = await deleteOrganization(testClient, organization.organization_id, { authorization: BillyAuthToken });
                    expect(gqlOrganization).to.be.true;
                    const dbOrganization = await Organization.findOneOrFail(organization.organization_id);
                    const dbOrganizationOwnership = await OrganizationOwnership.findOneOrFail({ where: { organization_id: organization.organization_id } });
                    expect(dbOrganizationOwnership.status).to.eq(Status.INACTIVE)
                });

                context("and the organization is marked as inactive", () => {
                    beforeEach(async () => {
                        await deleteOrganization(testClient, organization.organization_id, { authorization: JoeAuthToken });
                    });

                    it("fails to delete the organization", async () => {
                        const gqlOrganization = await deleteOrganization(testClient, organization.organization_id, { authorization: BillyAuthToken });
                        expect(gqlOrganization).to.be.null;
                        const dbOrganization = await Organization.findOneOrFail(organization.organization_id);
                        expect(dbOrganization.status).to.eq(Status.INACTIVE);
                        expect(dbOrganization.deleted_at).not.to.be.null;
                    });
                });
            });
        });
    });
});
