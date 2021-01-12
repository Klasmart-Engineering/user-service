import { User } from "../../../src/entities/user";
import { expect } from "chai";
import { ApolloServerTestClient } from "../createTestClient";
import { v4 as uuidv4 } from "uuid"
import { Headers } from 'node-mocks-http';
import { gqlTry } from "../gqlTry";
import { getJoeToken, generateToken } from "../testConfig";
import { userToPayload } from "./userOps"
 


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
    query myQuery(
        $email:String
        $phone:String) {
        users (
            email: $email
            phone: $phone) {
            user_id
            given_name
            family_name
            email
            phone
            profile_name
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


const GET_ME =  `
    query myQuery {
        me {
            user_id
            given_name
            family_name
            email
            phone
            profile_name
            avatar
        }
    }
`;

export async function createUserAndValidate(
    testClient: ApolloServerTestClient,
    user: User
): Promise<User> {
    user.user_id = user.user_id ?? uuidv4()
    const token = generateToken(userToPayload(user))
    const gqlUser = await getMe(testClient, { authorization: token });
    const dbUser = await User.findOneOrFail({ where: { user_id: user.user_id } });
    expect(gqlUser).to.exist;
    expect(gqlUser).to.include(user);
    expect(dbUser).to.include(user);

    return gqlUser;
}


export async function updateUser(testClient: ApolloServerTestClient, modifiedUser: any, headers?: Headers) {
    const { mutate } = testClient;

    const operation = () => mutate({
        mutation: SET_USER,
        variables: modifiedUser,
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.user as User;
    return gqlUser;
}

export async function getUsers(testClient: ApolloServerTestClient, email?:string, phone?:string,headers?: Headers) {
    const { query } = testClient;
  
    let variables:any = {}
    if(email !== undefined){        
        variables.email = email
    }
    if(phone !== undefined){
        variables.phone = phone
    }
    const operation = () => query({
        query: GET_USERS,
        headers: headers,
        variables: variables
    });

    const res = await gqlTry(operation);
    const gqlUsers = res.data?.users as User[];
    return gqlUsers;
}

export async function getUser(testClient: ApolloServerTestClient, userId: string, headers?: Headers) {
    const { query } = testClient;
            
    const operation = () => query({
        query: GET_USER,
        variables: { user_id: userId },
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.user as User;
    return gqlUser;
}

export async function getMe(testClient: ApolloServerTestClient, headers?: Headers) {
    const { query } = testClient;
            
    const operation = () => query({
        query: GET_ME,
        headers: headers,
    });

    const res = await gqlTry(operation);
    const gqlUser = res.data?.me as User;
    return gqlUser;
}
