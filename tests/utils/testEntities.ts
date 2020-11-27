import { User } from "../../src/entities/user";
import { ApolloServerTestClient } from "./createTestClient";
import { createUser } from "./operations/modelOps";

export async function createUserJoe(testClient: ApolloServerTestClient) {
    return createUser(testClient, joe);
}

export async function createUserBilly(testClient: ApolloServerTestClient) {
    return createUser(testClient, billy);
}

const joe = {
    user_id: "c6d4feed-9133-5529-8d72-1003526d1b13",
    given_name: "Joe",
    family_name: "Brown",
    email: "joe@gmail.com",
    birth_year_month: new Date("2016-01-22T18:25:43.511Z")
} as User;

const billy = {
    user_id: "fcf922e5-25c9-5dce-be9f-987a600c1356",
    given_name: "Billy",
    family_name: "Bob",
    email: "billy@gmail.com",
    birth_year_month: new Date("2014-09-13T12:25:20.331Z")
} as User;