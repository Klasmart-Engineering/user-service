import { User } from "../../src/entities/user";
import { ApolloServerTestClient } from "./createTestClient";
import { createUser } from "./operations/modelOps";

export function createUserJoe(testClient: ApolloServerTestClient) {
    return createUser(testClient, joe);
}

export function createUserBilly(testClient: ApolloServerTestClient) {
    return createUser(testClient, billy);
}

const joe = {
    user_id: "c6d4feed-9133-5529-8d72-1003526d1b13",
    user_name: "JoeBrown",
    email: "joe@gmail.com",
    avatar: "joe_avatar",
} as User;

const billy = {
    user_id: "fcf922e5-25c9-5dce-be9f-987a600c1356",
    user_name: "BillyBob",
    email: "billy@gmail.com",
    avatar: "billy_avatar",
} as User;