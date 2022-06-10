import faker from 'faker'
import { User } from '../../src/entities/user'
import clean from '../../src/utils/clean'
import { createOrganization } from './organization.factory'
import { createRole } from './role.factory'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from './organizationMembership.factory'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { userToPayload } from '../utils/operations/userOps'

const DEFAULT_GENDERS = ['Male', 'Female', 'Unspecified']

export const ADMIN_EMAIL = UserPermissions.ADMIN_EMAILS[0]

type PartialUser = Pick<
    User,
    | 'given_name'
    | 'family_name'
    | 'email'
    | 'phone'
    | 'username'
    | 'date_of_birth'
    | 'gender'
    | 'alternate_email'
    | 'alternate_phone'
>

export function createUser({
    given_name,
    family_name,
    email,
    phone,
    username,
    date_of_birth,
    gender,
    alternate_email,
    alternate_phone,
}: PartialUser = {}) {
    const user = new User()

    user.given_name = given_name ?? faker.name.firstName()
    user.family_name = family_name ?? faker.name.lastName()
    user.email = email ?? (clean.email(faker.internet.email()) as string)
    user.phone =
        phone ?? (clean.phone(faker.phone.phoneNumber('+44#######')) as string)
    user.username = username ?? faker.name.firstName()
    user.date_of_birth = date_of_birth ?? '01-2018'
    user.gender = gender ?? faker.random.arrayElement(DEFAULT_GENDERS)
    user.alternate_email = alternate_email
    user.alternate_phone = alternate_phone

    return user
}

export function createAdminUser() {
    return createUser({ email: ADMIN_EMAIL })
}

export const createUsers = (length: number, partialUser?: PartialUser) =>
    Array(length).fill(partialUser).map(createUser)

export const makeUserWithPermission = async (permission: PermissionName) => {
    const clientUser = await createUser().save()
    const permittedOrg = await createOrganization().save()
    const role = await createRole(undefined, permittedOrg, {
        permissions: [permission],
    }).save()

    await createOrganizationMembership({
        user: clientUser,
        organization: permittedOrg,
        roles: [role],
    }).save()

    const permissions = new UserPermissions(userToPayload(clientUser))

    return { permittedOrg, userCtx: { permissions }, clientUser }
}

export const makeUserWithoutPermissions = async () => {
    const user = await createUser().save()
    const organization = await createOrganization().save()
    const role = await createRole(undefined, organization).save()

    await createOrganizationMembership({
        user,
        organization,
        roles: [role],
    }).save()

    const permissions = new UserPermissions(userToPayload(user))

    return { organization, userCtx: { permissions }, user }
}
