import faker from 'faker'
import { User } from '../../src/entities/user'

const DEFAULT_GENDERS = ['Male', 'Female', 'Unspecified']

const ADMIN_EMAIL = 'joe@gmail.com'

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
}: Pick<
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
> = {}) {
    const user = new User()

    user.given_name = given_name ?? faker.name.firstName()
    user.family_name = family_name ?? faker.name.lastName()
    user.email = email ?? faker.internet.email()
    user.phone = phone ?? faker.phone.phoneNumber('+44#######')
    user.username = username ?? faker.internet.userName()
    user.date_of_birth = date_of_birth ?? '01-2018'
    user.gender = gender ?? faker.random.arrayElement(DEFAULT_GENDERS)
    user.alternate_email = alternate_email
    user.alternate_phone = alternate_phone

    return user
}

export function createAdminUser() {
    return createUser({ email: ADMIN_EMAIL })
}
