import { User } from "../../src/entities/user";
import { ApolloServerTestClient } from "./createTestClient";
import { createUserAndValidate } from "./operations/modelOps";

export function createUserJoe(testClient: ApolloServerTestClient) {
    return createUserAndValidate(testClient, joe);
}

export function createUserBilly(testClient: ApolloServerTestClient) {
    return createUserAndValidate(testClient, billy);
}

const joe = {
    user_id: "c6d4feed-9133-5529-8d72-1003526d1b13",
    given_name: "Joe",
    family_name: "Brown",
    email: "joe@gmail.com",
    avatar: "joe_avatar",
} as User;

const billy = {
    user_id: "fcf922e5-25c9-5dce-be9f-987a600c1356",
    given_name: "Billy",
    family_name: "Bob",
    email: "billy@gmail.com",
    avatar: "billy_avatar",
} as User;