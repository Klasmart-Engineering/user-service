import { User } from "../../../src/entities/user";
import { expect } from "chai";
import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken } from "../testConfig";
import { gqlTry } from "../gqlTry";

const NEW_USER = `
    mutation myMutation(
            $given_name: String
            $family_name: String
            $email: String
            $avatar: String) {
        newUser(
            given_name: $given_name
            family_name: $family_name
            email: $email
            avatar: $avatar
        ) {
            user_id
            given_name
            family_name
            email
            avatar
        }
    }
`;

const SET_USER = `
    mutation myMutation(
            $user_id: ID!
            $given_name: String
            $family_name: String
            $email: String
            $avatar: String) {
        user(
            user_id: $user_id
            given_name: $given_name
            family_name: $family_name
            email: $email
            avatar: $avatar
        ) {
            user_id
            given_name
            family_name
            email
            avatar
        }
    }
`;

const GET_USERS = `
    query myQuery {
        users {
            user_id
            given_name
            family_name
            email
            avatar
        }
    }
`;

const GET_USER = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            user_id
            given_name
            family_name
            email
            avatar
        }
    }
`;

/**
 * Creates a new user, and makes extra assertions about what the new state should be (e.g. it got added to the db).
 */
export async function createUserAndValidate(
    testClient: ApolloServerTestClient,
    user: User
): Promise<User> {
    const gqlUser = await createUser(testClient, user);
    const dbUser = await User.findOneOrFail({ where: { email: user.email } });
    expect(gqlUser).to.exist;
    expect(gqlUser).to.include(user);
    expect(dbUser).to.include(user);

    return gqlUser;
}

/**
 * Creates a new user, verifies the GraphQL operation completed without error, and returns the GraphQL response.
 */
export async function createUser(
    testClient: ApolloServerTestClient,
    user: User
): Promise<User> {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: NEW_USER,
        variables: user as any,
        headers: { authorization: JoeAuthToken },
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.newUser as User;
    return gqlUser;
}

export async function updateUser(testClient: ApolloServerTestClient, modifiedUser: any) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: SET_USER,
        variables: modifiedUser,
        headers: { authorization: JoeAuthToken },
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.user as User;
    return gqlUser;
}

export async function getUsers(testClient: ApolloServerTestClient) {
    const { query } = testClient;

    const operation = () => query({
        query: GET_USERS,
    });

    const res = await gqlTry(operation);
    const gqlUsers = res.data?.users as User[];
    return gqlUsers;
}

export async function getUser(testClient: ApolloServerTestClient, userId: string) {
    const { query } = testClient;
            
    const operation = () => query({
        query: GET_USER,
        variables: { user_id: userId },
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.user as User;
    return gqlUser;
}