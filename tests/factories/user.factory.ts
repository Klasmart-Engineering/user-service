import faker from 'faker'
import { User } from '../../src/entities/user'

const genderOptions = ['Male', 'Female', 'Unspecified']

export function createUser({
            given_name,
            family_name,
            email,
            phone,
            username,
            date_of_birth,
            gender,
        }: Partial<User>) {
    const user = new User()

    user.given_name = given_name || faker.name.firstName()
    user.family_name = family_name || faker.name.lastName()
    user.email = email || faker.internet.email()
    user.phone = phone || faker.phone.phoneNumber('+44#######')
    user.username = username || faker.internet.userName()
    user.date_of_birth = date_of_birth || '01-2018'
    user.gender = gender || faker.random.arrayElement(genderOptions)

    return user
}
