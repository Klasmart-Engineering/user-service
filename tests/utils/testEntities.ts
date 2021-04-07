import { User } from "../../src/entities/user";
import { ApolloServerTestClient } from "./createTestClient";
import { createUserAndValidate } from "./operations/modelOps";
import { userToPayload } from "./operations/userOps";
import { generateToken, setBillyAuthToken, setJoeAuthToken, setJoeAuthWithoutIdToken } from "./testConfig";

export async function createUserJoe(testClient: ApolloServerTestClient) {
    const joeUser = await createUserAndValidate(testClient, joe);
    if(joeUser) {
        setJoeAuthToken(generateToken(userToPayload(joeUser)))
        setJoeAuthWithoutIdToken(generateToken(userToPayload(joe)))
        
    }
    return joeUser
}

export async function createUserBilly(testClient: ApolloServerTestClient) {
    const billyUser = await createUserAndValidate(testClient, billy);
    if(billyUser) {
        setBillyAuthToken(generateToken(userToPayload(billyUser)))
    }
    return billyUser
}

const joe = {
    given_name: "Joe",
    family_name: "Brown",
    email: "joe@gmail.com",
    avatar: "joe_avatar",
    date_of_birth: "03-1984",
    username: "Tigger",
} as User;

const billy = {
    given_name: "Billy",
    family_name: "Bob",
    email: "billy@gmail.com",
    avatar: "billy_avatar",
} as User;