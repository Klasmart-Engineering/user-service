import { User } from "../../../src/entities/user";
import faker from "faker";
import { expect } from "chai";
import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken } from "../testConfig";


//TODO: replace user_name with given_name and family_name
const NEW_USER = `
    mutation myMutation(
            $user_name: String
            $email: String
            $avatar: String) {
        newUser(
            user_name: $user_name
            email: $email
            avatar: $avatar
        ) {
            user_id
            user_name
            email
            avatar
        }
    }
`;

//TODO: replace user_name with given_name and family_name
const SET_USER = `
    mutation myMutation(
            $user_id: ID!
            $user_name: String
            $email: String
            $avatar: String) {
        user(
            user_id: $user_id
            user_name: $user_name
            email: $email
            avatar: $avatar
        ) {
            user_id
            user_name
            email
            avatar
        }
    }
`;

//TODO: replace user_name with given_name and family_name
const GET_USERS = `
    query myQuery {
        users {
            user_id
            user_name
            email
            avatar
        }
    }
`;

const GET_USER = `
    query myQuery($user_id: ID!) {
        user(user_id: $user_id) {
            user_id
            user_name
            email
            avatar
        }
    }
`;

export async function createUser(
    testClient: ApolloServerTestClient,
    user: User
): Promise<User> {
    const { mutate } = testClient;

    const res = await mutate({
        mutation: NEW_USER,
        variables: user as any,
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    const gqlUser = res.data?.newUser as User;
    //TODO: replace user_name with given_name and family_name
    const dbUser = await User.findOneOrFail({ where: { user_name: user.user_name } });
    expect(gqlUser).to.exist;
    expect(gqlUser).to.include(user);
    expect(dbUser).to.include(user);

    return dbUser;
}

export async function updateUser(testClient: ApolloServerTestClient, user: User) {
    const modifiedUser = {
        user_id: user.user_id,
        user_name: faker.internet.userName(),
        email: faker.internet.email(),
        avatar: "my new avatar",
    };

    const { mutate } = testClient;

    const res = await mutate({
        mutation: SET_USER,
        variables: modifiedUser,
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlUser = res.data?.user as User;
    expect(gqlUser).to.exist;
    expect(gqlUser).to.include(modifiedUser);
    return gqlUser;
}

export async function getUsers(testClient: ApolloServerTestClient) {
    const { query } = testClient;

    const res = await query({
        query: GET_USERS,
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlUsers = res.data?.users as User[];
    return gqlUsers;
}

export async function getUser(testClient: ApolloServerTestClient, userId: string) {
    const { query } = testClient;
            
    const res = await query({
        query: GET_USER,
        variables: { user_id: userId },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlUser = res.data?.user as User;
    return gqlUser;
}