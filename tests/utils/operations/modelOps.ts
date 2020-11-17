import { User } from "../../../src/entities/user";
import faker from "faker";
import { expect } from "chai";
import { ApolloServerTestClient } from "../createTestClient";
import { AuthToken } from "../testConfig";

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

export function createUserJoe(testClient: ApolloServerTestClient) {
    return createUser(testClient, joe);
}

export function createUserBilly(testClient: ApolloServerTestClient) {
    return createUser(testClient, billy);
}

export async function createUserWithRandomData(testClient: ApolloServerTestClient) {
    const user = {
        user_name: faker.internet.userName(),
        email: faker.internet.email(),
        avatar: "my_avatar",
    } as User;

    return createUser(testClient, user);
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
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    const gqlUser = res.data?.user as User;
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

const joe = {
    user_id: "c6d4feed-9133-5529-8d72-1003526d1b13",
    user_name: "JoeBrown",
    email: "joe@gmail.com",
    avatar: "joe_avatar",
} as User;

const billy = {
    user_name: "BillyBob",
    email: "billy@gmail.com",
    avatar: "billy_avatar",
} as User;

async function createUser(
    testClient: ApolloServerTestClient,
    user: User
): Promise<User> {
    const { mutate } = testClient;

    const res = await mutate({
        mutation: NEW_USER,
        variables: user as any,
        headers: { authorization: AuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;

    const gqlUser = res.data?.newUser as User;
    const dbUser = await User.findOneOrFail({ where: { user_name: user.user_name } });
    expect(gqlUser).to.exist;
    expect(gqlUser).to.include(user);
    expect(dbUser).to.include(user);

    return dbUser;
}