import { User } from "../../src/entities/user";
import { ApolloServerTestClient } from "./createTestClient";
import { getMe } from "./operations/modelOps";
import { setJoeToken, setBillyToken, setSuperBillyToken, getJoeToken, getBillyToken}  from "./testConfig"
import { userToPayload, userToSuperPayload } from "./operations/userOps"


export async function createUserJoe(testClient: ApolloServerTestClient) {
    const joeUser = await getMe(testClient, { authorization: getJoeToken() })
    // const joeUser =  await createUser(testClient, joe,{ authorization: getJoeToken() });
    setJoeToken(userToPayload(joeUser))
    return joeUser
}

export async function createUserBilly(testClient: ApolloServerTestClient) {
    const billyUser = await getMe(testClient, { authorization: getBillyToken() })
    //const billyUser = await createUser(testClient, billy,{ authorization: getBillyToken() });
    setBillyToken(userToPayload(billyUser))
    setSuperBillyToken(userToSuperPayload(billyUser))
    return billyUser
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

