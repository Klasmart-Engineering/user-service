import { User } from '../../src/entities/user'
import { ApolloServerTestClient } from './createTestClient'
import { createUserAndValidate } from './operations/modelOps'
import { userToPayload } from './operations/userOps'
import {
    generateToken,
    setNonAdminAuthToken,
    setAdminAuthToken,
    setAdminAuthWithoutIdToken,
} from './testConfig'

export async function createAdminUser(testClient: ApolloServerTestClient) {
    const adminUser = await createUserAndValidate(testClient, joe)
    if (adminUser) {
        setAdminAuthToken(generateToken(userToPayload(adminUser)))
        setAdminAuthWithoutIdToken(generateToken(userToPayload(joe)))
    }
    return adminUser
}

export async function createNonAdminUser(testClient: ApolloServerTestClient) {
    const nonAdminUser = await createUserAndValidate(testClient, billy)
    if (nonAdminUser) {
        setNonAdminAuthToken(generateToken(userToPayload(nonAdminUser)))
    }
    return nonAdminUser
}

const joe = {
    given_name: 'Joe',
    family_name: 'Brown',
    email: 'joe@gmail.com',
    avatar: 'joe_avatar',
    date_of_birth: '03-1984',
    username: 'Tigger',
} as User

const billy = {
    given_name: 'Billy',
    family_name: 'Bob',
    email: 'billy@gmail.com',
    avatar: 'billy_avatar',
} as User
