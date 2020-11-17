import { expect } from "chai";
import { ApolloServerTestClient } from "../createTestClient";
import { AuthToken } from "../testConfig";

const ADD_ROLE_TO_SCHOOL_MEMBERSHIP = `
    mutation myMutation(
            $user_id: ID!
            $school_id: ID!
            $role_id: ID!) {
        user(user_id: $user_id) {
            school_membership(school_id: $school_id) {
                addRole(role_id: $role_id) {
                    role_id
                    role_name
                }
            }
        }
    }
`;

export async function addRoleToSchoolMembership(testClient: ApolloServerTestClient, userId: string, schoolId: string, roleId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_ROLE_TO_SCHOOL_MEMBERSHIP,
        variables: { user_id: userId, school_id: schoolId, role_id: roleId },
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
}