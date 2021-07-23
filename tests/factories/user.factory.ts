import faker from 'faker'
import { User } from '../../src/entities/user'

const gender = ['Male', 'Female', 'Unspecified']

export function createUser() {
    const user = new User()

    user.given_name = faker.name.firstName()
    user.family_name = faker.name.lastName()
    user.email = faker.internet.email()
    user.phone = faker.phone.phoneNumber('+44#######')
    user.username = faker.internet.userName()
    user.date_of_birth = '01-2018'
    user.gender = faker.random.arrayElement(gender)

    return user
}
