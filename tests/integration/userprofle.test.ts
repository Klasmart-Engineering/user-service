import { expect } from "chai";
import { Connection } from "typeorm"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { User } from "../../src/entities/user";
import { OrganizationMembership } from "../../src/entities/organizationMembership";
import { createOrganization, getClassesStudying, getClassesTeaching, getOrganizationMembership, getOrganizationMemberships, getSchoolMembership, getSchoolMemberships, updateUser } from "../utils/operations/userOps";
import { createUserJoe } from "../utils/testEntities";
import { createSchool, createClass } from "../utils/operations/organizationOps";
import { addStudentToClass, addTeacherToClass } from "../utils/operations/classOps";
import { ApolloServerTestClient, createTestClient } from "../utils/createTestClient";
import { addOrganizationToUser } from "../utils/operations/userOps";
import { addUserToSchool } from "../utils/operations/schoolOps";
import { SchoolMembership } from "../../src/entities/schoolMembership";
import { JoeAuthToken } from "../utils/testConfig";
import { UserProfile } from "../../src/entities/userprofile";

describe("userprofile", () => {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let user: User;

    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });
    
    after(async () => {
        await connection?.close();
    });

    function reloadDatabase() {
        return connection?.synchronize(true);
    }

    describe("CreateDefaultuserprofile", () => {
        beforeEach(async () => {
            await reloadDatabase();
            user = await createUserJoe(testClient);
        });

        it("should create a default userprofile", async () => {
            const gqlUpdatedUser = await updateUser(testClient, user);
            const dbUser = await User.findOneOrFail({ where: { user_id: user.user_id } });
            expect(gqlUpdatedUser).to.exist;
            expect(dbUser).to.include(gqlUpdatedUser);
            const dbUserProfiles = await UserProfile.find({ where: { user_profile_user_id: user.user_id} });
            expect (dbUserProfiles).to.exist;
            expect (dbUserProfiles).to.have.length(1)
            expect (dbUserProfiles[0].user_profile_name).to.be.equal("default")
            expect (dbUserProfiles[0].user_profile_user_id).to.be.equal(user.user_id)
        });
    });
});
