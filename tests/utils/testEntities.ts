import { User } from '../../src/entities/user'
import { UserPermissions } from '../../src/permissions/userPermissions'
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
    email: UserPermissions.ADMIN_EMAILS[0],
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

export const validUser = {
    given_name: 'Joe',
    family_name: 'Bloggs',
    email: 'joe.bloggs@gmail.com',
    phone: '+4412345678910',
    date_of_birth: '01-2000',
    username: 'JOE123!',
    gender: 'Male',
    alternate_email: 'joe.bloggs@calmid.com',
    alternate_phone: '+4454321109876',
}
