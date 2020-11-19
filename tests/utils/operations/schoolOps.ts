import { ApolloServerTestClient } from "../createTestClient";
import { expect } from "chai";
import { School } from "../../../src/entities/school";
import { JoeAuthToken } from "../testConfig";

const ADD_USER_TO_SCHOOL = `
    mutation myMutation(
            $user_id: ID!
            $school_id: ID!) {
        school(school_id: $school_id) {
            addUser(user_id: $user_id) {
                user_id
                school_id
            }
        }
    }
`;

export async function addUserToSchool(testClient: ApolloServerTestClient, userId: string, schoolId: string) {
    const { mutate } = testClient;
    
    const res = await mutate({
        mutation: ADD_USER_TO_SCHOOL,
        variables: { user_id: userId, school_id: schoolId },
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
}