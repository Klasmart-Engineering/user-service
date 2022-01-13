import faker from 'faker'
import { User } from '../../src/entities/user'
import clean from '../../src/utils/clean'

const DEFAULT_GENDERS = ['Male', 'Female', 'Unspecified']

export const ADMIN_EMAIL = 'joe@gmail.com'

type PartialUser = Pick<
    User,
    | 'given_name'
    | 'family_name'
    | 'email'
    | 'phone'
    | 'username'
    | 'id_provider'
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
    id_provider,
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
    user.id_provider = id_provider
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
