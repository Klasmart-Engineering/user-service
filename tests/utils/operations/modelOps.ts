import { User } from "../../../src/entities/user";
import faker from "faker";
import { expect } from "chai";
import { ApolloServerTestClient } from "../createTestClient";
import { JoeAuthToken } from "../testConfig";

const NEW_USER = `
    mutation myMutation(
            $given_name: String
            $family_name: String
            $email: String
            $avatar: Upload
            $birth_year_month: Date) {
        newUser(
            given_name: $given_name
            family_name: $family_name
            email: $email
            avatar: $avatar
            birth_year_month: $birth_year_month
        ) {
            user_id
            given_name
            family_name
            email
            avatar
            birth_year_month
            errors {
                property
                value
                constraint
            }
        }
    }
`;

const SET_USER = `
    mutation myMutation(
            $user_id: ID!
            $given_name: String
            $family_name: String
            $email: String
            $birth_year_month: Date) {
        user(
            user_id: $user_id
            given_name: $given_name
            family_name: $family_name
            email: $email
            birth_year_month: $birth_year_month
        ) {
            user_id
            given_name
            family_name
            email
            avatar
            birth_year_month
            errors {
                property
                value
                constraint
            }
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

export async function createUser(
    testClient: ApolloServerTestClient,
    user: User
): Promise<User> {
    const { mutate } = testClient;

    const res = await mutate({
        mutation: NEW_USER,
        variables: JSON.parse(JSON.stringify(user)),
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    expect(res.data?.newUser.errors).to.be.null;

    const gqlUser = res.data?.newUser as User;
    const dbUser = await User.findOneOrFail({ where: { email: user.email } });

    expect(gqlUser).to.exist;

    expect(gqlUser).to.include(JSON.parse(JSON.stringify(user)));
    expect(JSON.parse(JSON.stringify(dbUser))).to.include(JSON.parse(JSON.stringify(user)));

    return dbUser;
}

export async function updateUser(testClient: ApolloServerTestClient, user: User) {
    const modifiedUser = {
        user_id: user.user_id,
        given_name: faker.name.firstName(),
        family_name: faker.name.lastName(),
        email: faker.internet.email(),
        birth_year_month: user.birth_year_month?.toISOString()
    };

    const { mutate } = testClient;

    const res = await mutate({
        mutation: SET_USER,
        variables: modifiedUser,
        headers: { authorization: JoeAuthToken },
    });

    expect(res.errors, res.errors?.toString()).to.be.undefined;
    expect(res.data?.user.errors).to.be.null;
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
    const gqlUsers = res.data?.users;
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