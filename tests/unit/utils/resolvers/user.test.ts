import { expect } from 'chai'
import faker from 'faker'
import { User } from '../../../../src/entities/user'
import {
    CreateUserInput,
    UpdateUserInput,
} from '../../../../src/types/graphQL/user'
import {
    ConflictingUserKey,
    createUserInputToConflictingUserKey,
    buildConflictingUserKey,
    addIdentifierToKey,
    cleanCreateUserInput,
    updateUserInputToConflictingUserKey,
    cleanUpdateUserInput,
} from '../../../../src/utils/resolvers/user'
import { createUser, createUsers } from '../../../factories/user.factory'
import {
    userToCreateUserInput,
    userToUpdateUserInput,
} from '../../../utils/operations/userOps'
import {
    TestConnection,
    createTestConnection,
} from '../../../utils/testConnection'

describe('User', () => {
    context('createUserInputToConflictingUserKey', () => {
        const generateInput = (
            nullIt?: ('username' | 'email' | 'phone')[]
        ): CreateUserInput => {
            return {
                givenName: faker.name.firstName(),
                familyName: faker.name.lastName(),
                gender: faker.random.arrayElement(['female', 'male']),
                username: nullIt?.includes('username')
                    ? null
                    : faker.name.firstName(),
                contactInfo: {
                    email: nullIt?.includes('email')
                        ? null
                        : faker.internet.email(),
                    phone: nullIt?.includes('phone')
                        ? null
                        : faker.phone.phoneNumber('+44#######'),
                },
            }
        }

        const expectKey = (input: CreateUserInput, key: ConflictingUserKey) => {
            expect(key.givenName).to.eq(input.givenName)
            expect(key.familyName).to.eq(input.familyName)
            expect(key.username).to.eq(input.username)
            expect(key.email).to.eq(input.contactInfo?.email)
            expect(key.phone).to.eq(input.contactInfo?.phone)
        }

        it('transforms CreateUserInput to ConflictingUserKey', () => {
            const input: CreateUserInput = generateInput()
            const key: ConflictingUserKey = createUserInputToConflictingUserKey(
                input
            )

            expectKey(input, key)
        })

        it('undefined values are setted as undefined', () => {
            const input: CreateUserInput = generateInput()
            input.username = undefined
            const key: ConflictingUserKey = createUserInputToConflictingUserKey(
                input
            )

            expectKey(input, key)
        })

        it('null values are setted as undefined', () => {
            const input: CreateUserInput = generateInput(['username', 'email'])
            const key: ConflictingUserKey = createUserInputToConflictingUserKey(
                input
            )

            expect(key.givenName).to.eq(input.givenName)
            expect(key.familyName).to.eq(input.familyName)
            expect(key.username).to.be.undefined
            expect(key.email).to.be.undefined
            expect(key.phone).to.eq(input.contactInfo?.phone)
        })
    })

    context('updateUserInputToConflictingUserKey', () => {
        let connection: TestConnection
        let users: User[]
        let usersMap: Map<string, User>

        before(async () => {
            connection = await createTestConnection()
        })

        after(async () => {
            await connection.close()
        })

        beforeEach(async () => {
            users = await User.save(createUsers(3))
            usersMap = new Map(users.map((u) => [u.user_id, u]))
        })

        const generateInput = (
            user: User,
            omit?: (keyof UpdateUserInput)[]
        ): UpdateUserInput => {
            return {
                id: user.user_id,
                givenName: omit?.includes('givenName')
                    ? undefined
                    : faker.name.firstName(),
                familyName: omit?.includes('familyName')
                    ? undefined
                    : faker.name.lastName(),
                username: omit?.includes('username')
                    ? undefined
                    : faker.name.firstName(),
                email: omit?.includes('email')
                    ? undefined
                    : faker.internet.email(),
                phone: omit?.includes('phone')
                    ? undefined
                    : faker.phone.phoneNumber('+44#######'),
            }
        }

        it('transforms UpdateUserInput to ConflictingUserKey', () => {
            const input: UpdateUserInput = generateInput(users[0])
            const key: ConflictingUserKey = updateUserInputToConflictingUserKey(
                input,
                usersMap
            )

            expect(key.givenName).to.eq(input.givenName)
            expect(key.familyName).to.eq(input.familyName)
            expect(key.username).to.eq(input.username)
            expect(key.email).to.eq(input.email)
            expect(key.phone).to.eq(input.phone)
        })

        it('undefined values are found in the map', () => {
            const input: UpdateUserInput = generateInput(users[0], [
                'givenName',
                'familyName',
                'username',
            ])

            const key: ConflictingUserKey = updateUserInputToConflictingUserKey(
                input,
                usersMap
            )

            const userInMap = usersMap.get(input.id)

            expect(key.givenName).to.eq(userInMap?.given_name)
            expect(key.familyName).to.eq(userInMap?.family_name)
            expect(key.username).to.eq(userInMap?.username)
            expect(key.email).to.eq(input.email)
            expect(key.phone).to.eq(input.phone)
        })
    })

    context('buildConflictingUserKey', () => {
        const generateKey = (
            omit?: ('username' | 'email' | 'phone')[]
        ): ConflictingUserKey => {
            return {
                givenName: faker.name.firstName(),
                familyName: faker.name.lastName(),
                username: omit?.includes('username')
                    ? undefined
                    : faker.name.firstName(),
                email: omit?.includes('email')
                    ? undefined
                    : faker.internet.email(),
                phone: omit?.includes('phone')
                    ? undefined
                    : faker.phone.phoneNumber('+44#######'),
            }
        }

        context('when all the identifiers are provided', () => {
            it('sets username as the identifier', () => {
                const initialKey = generateKey()
                const identifierKey = buildConflictingUserKey(initialKey)

                expect(identifierKey.givenName).to.eq(initialKey.givenName)
                expect(identifierKey.familyName).to.eq(initialKey.familyName)
                expect(identifierKey.username).to.eq(initialKey.username)
                expect(identifierKey.email).to.be.undefined
                expect(identifierKey.phone).to.be.undefined
            })
        })

        context('when username is not provided', () => {
            it('sets email as the identifier', () => {
                const initialKey = generateKey(['username'])
                const identifierKey = buildConflictingUserKey(initialKey)

                expect(identifierKey.givenName).to.eq(initialKey.givenName)
                expect(identifierKey.familyName).to.eq(initialKey.familyName)
                expect(identifierKey.username).to.be.undefined
                expect(identifierKey.email).to.eq(initialKey.email)
                expect(identifierKey.phone).to.be.undefined
            })
        })

        context('when username is not provided neither email', () => {
            it('sets phone as the identifier', () => {
                const initialKey = generateKey(['username', 'email'])
                const identifierKey = buildConflictingUserKey(initialKey)

                expect(identifierKey.givenName).to.eq(initialKey.givenName)
                expect(identifierKey.familyName).to.eq(initialKey.familyName)
                expect(identifierKey.username).to.be.undefined
                expect(identifierKey.email).to.be.undefined
                expect(identifierKey.phone).to.eq(initialKey.phone)
            })
        })

        context('when any identifier is not provided', () => {
            it('sets nothing as the identifier', () => {
                const initialKey = generateKey(['username', 'email', 'phone'])
                const identifierKey = buildConflictingUserKey(initialKey)

                expect(identifierKey.givenName).to.eq(initialKey.givenName)
                expect(identifierKey.familyName).to.eq(initialKey.familyName)
                expect(identifierKey.username).to.be.undefined
                expect(identifierKey.email).to.be.undefined
                expect(identifierKey.phone).to.be.undefined
            })
        })
    })

    context('addIdentifierToKey', () => {
        context('when all params are provided', () => {
            it('returns username', () => {
                const identifier = addIdentifierToKey(
                    'userone',
                    'user.one@gmail.com',
                    '+441234567890'
                )

                expect(identifier).to.have.property('username')
                expect(identifier?.username).to.eq('userone')
            })
        })

        context('when username is not provided', () => {
            it('returns email', () => {
                const identifier = addIdentifierToKey(
                    undefined,
                    'user.one@gmail.com',
                    '+441234567890'
                )

                expect(identifier).to.have.property('email')
                expect(identifier?.email).to.eq('user.one@gmail.com')
            })
        })

        context('when username is not provided neither email', () => {
            it('returns phone', () => {
                const identifier = addIdentifierToKey(
                    undefined,
                    undefined,
                    '+441234567890'
                )

                expect(identifier).to.have.property('phone')
                expect(identifier?.phone).to.eq('+441234567890')
            })
        })

        context('when any param is not provided', () => {
            it('returns phone', () => {
                const identifier = addIdentifierToKey()
                expect(identifier).to.be.undefined
            })
        })
    })

    context('cleanCreateUserInput', () => {
        const validateNonCleanableFields = (
            result: CreateUserInput,
            expected: CreateUserInput
        ) => {
            expect(result.givenName).to.eq(expected.givenName)
            expect(result.familyName).to.eq(expected.familyName)
            expect(result.gender).to.eq(expected.gender)
            expect(result.username).to.eq(expected.username)
        }

        context(
            'when all info is provided and normalization is not needed on any field',
            () => {
                it('result should be equal to input', () => {
                    const input = userToCreateUserInput(
                        createUser({
                            alternate_email: faker.internet
                                .email()
                                .toLowerCase(),
                            alternate_phone: faker.phone.phoneNumber(
                                '+44#######'
                            ),
                        })
                    )
                    const result = cleanCreateUserInput(input)

                    validateNonCleanableFields(result, input)
                    expect(result.contactInfo).to.deep.equal(input.contactInfo)
                    expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                    expect(result.alternateEmail).to.eq(input.alternateEmail)
                    expect(result.alternatePhone).to.eq(input.alternatePhone)
                })
            }
        )

        context('when input emails or phones are empty string', () => {
            it('result email should be null', () => {
                const input = userToCreateUserInput(
                    createUser({
                        email: '',
                        phone: '',
                        alternate_email: '',
                        alternate_phone: '',
                    })
                )

                const result = cleanCreateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.contactInfo?.email).to.be.null
                expect(result.contactInfo?.phone).to.be.null
                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.be.null
                expect(result.alternatePhone).to.be.null
            })
        })

        context('when input emails need to be normalized', () => {
            it('result emails should be normalized', () => {
                const user = createUser({
                    email: 'ﬀmail1@gmail.com',
                    alternate_email: 'ﬀmail2@gmail.com',
                    alternate_phone: faker.phone.phoneNumber('+44#######'),
                })

                const input = userToCreateUserInput(user)
                const result = cleanCreateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.contactInfo?.email).to.eq('ffmail1@gmail.com')
                expect(result.contactInfo?.phone).to.eq(
                    input.contactInfo?.phone
                )

                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.eq('ffmail2@gmail.com')
                expect(result.alternatePhone).to.eq(input.alternatePhone)
            })
        })

        context('when input emails are sent in upper case', () => {
            it('result emails should be set in lower case', () => {
                const user = createUser({
                    alternate_email: faker.internet.email().toLowerCase(),
                    alternate_phone: faker.phone.phoneNumber('+44#######'),
                })

                const expectedValues = { ...user }
                user.email = user.email?.toUpperCase()
                user.alternate_email = user.alternate_email?.toUpperCase()

                const input = userToCreateUserInput(user)
                const result = cleanCreateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.contactInfo?.email).to.eq(expectedValues.email)
                expect(result.contactInfo?.phone).to.eq(
                    input.contactInfo?.phone
                )

                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.eq(
                    expectedValues.alternate_email
                )
                expect(result.alternatePhone).to.eq(input.alternatePhone)
            })
        })

        context(
            'when input emails or phones have spaces at start and/or end',
            () => {
                it('fields should be trimmed', () => {
                    const user = createUser({
                        alternate_email: faker.internet.email().toLowerCase(),
                        alternate_phone: faker.phone.phoneNumber('+44#######'),
                    })

                    const expectedValues = { ...user }
                    user.email = ` ${user.email} `
                    user.phone = `  ${user.phone}  `
                    user.alternate_email = `   ${user.alternate_email}   `
                    user.alternate_phone = `    ${user.alternate_phone}    `

                    const input = userToCreateUserInput(user)
                    const result = cleanCreateUserInput(input)

                    validateNonCleanableFields(result, input)
                    expect(result.contactInfo?.email).to.eq(
                        expectedValues.email
                    )
                    expect(result.contactInfo?.phone).to.eq(
                        expectedValues.phone
                    )
                    expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                    expect(result.alternateEmail).to.eq(
                        expectedValues.alternate_email
                    )
                    expect(result.alternatePhone).to.eq(
                        expectedValues.alternate_phone
                    )
                })
            }
        )

        context('when input phones have dashes, spaces or parenthesis', () => {
            it('dashes, spaces and parenthesis should be removed', () => {
                const user = createUser({
                    phone: '+52 (378)-123-4567',
                    alternate_email: faker.internet.email().toLowerCase(),
                    alternate_phone: '+52 (378)-789-1234',
                })

                const input = userToCreateUserInput(user)
                const result = cleanCreateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.contactInfo?.email).to.eq(
                    input.contactInfo?.email
                )
                expect(result.contactInfo?.phone).to.eq('+523781234567')
                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.eq(input.alternateEmail)
                expect(result.alternatePhone).to.eq('+523787891234')
            })
        })

        context('when input date of birth has not leading zero', () => {
            it('leading zero should be added', () => {
                const user = createUser({
                    date_of_birth: '2/1996',
                    alternate_email: faker.internet.email().toLowerCase(),
                    alternate_phone: faker.phone.phoneNumber('+44#######'),
                })

                const input = userToCreateUserInput(user)
                const result = cleanCreateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.contactInfo).to.deep.equal(input.contactInfo)
                expect(result.dateOfBirth).to.eq('02/1996')
                expect(result.alternateEmail).to.eq(input.alternateEmail)
                expect(result.alternatePhone).to.eq(input.alternatePhone)
            })
        })
    })

    context('cleanUpdateUserInput', () => {
        const validateNonCleanableFields = (
            result: UpdateUserInput,
            expected: UpdateUserInput
        ) => {
            expect(result.id).to.eq(expected.id)
            expect(result.givenName).to.eq(expected.givenName)
            expect(result.familyName).to.eq(expected.familyName)
            expect(result.gender).to.eq(expected.gender)
            expect(result.username).to.eq(expected.username)
            expect(result.avatar).to.eq(expected.avatar)
            expect(result.primaryUser).to.eq(expected.primaryUser)
        }

        context(
            'when all info is provided and normalization is not needed on any field',
            () => {
                it('result should be equal to input', () => {
                    const input = userToUpdateUserInput(
                        createUser({
                            alternate_email: faker.internet
                                .email()
                                .toLowerCase(),
                            alternate_phone: faker.phone.phoneNumber(
                                '+44#######'
                            ),
                        })
                    )

                    const result = cleanUpdateUserInput(input)

                    validateNonCleanableFields(result, input)
                    expect(result.email).to.eq(input.email)
                    expect(result.phone).to.eq(input.phone)
                    expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                    expect(result.alternateEmail).to.eq(input.alternateEmail)
                    expect(result.alternatePhone).to.eq(input.alternatePhone)
                })
            }
        )

        context('when input emails or phones are empty string', () => {
            it('those resulting fields should be undefined', () => {
                const input = userToUpdateUserInput(
                    createUser({
                        email: '',
                        phone: '',
                        alternate_email: '',
                        alternate_phone: '',
                    })
                )

                const result = cleanUpdateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.email).to.be.undefined
                expect(result.phone).to.be.undefined
                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.be.undefined
                expect(result.alternatePhone).to.be.undefined
            })
        })

        context('when input emails need to be normalized', () => {
            it('result emails should be normalized', () => {
                const user = createUser({
                    email: 'ﬀmail1@gmail.com',
                    alternate_email: 'ﬀmail2@gmail.com',
                    alternate_phone: faker.phone.phoneNumber('+44#######'),
                })

                const input = userToUpdateUserInput(user)
                const result = cleanUpdateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.email).to.eq('ffmail1@gmail.com')
                expect(result.phone).to.eq(input.phone)
                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.eq('ffmail2@gmail.com')
                expect(result.alternatePhone).to.eq(input.alternatePhone)
            })
        })

        context('when input emails are sent in upper case', () => {
            it('result emails should be set in lower case', () => {
                const user = createUser({
                    alternate_email: faker.internet.email().toLowerCase(),
                    alternate_phone: faker.phone.phoneNumber('+44#######'),
                })

                const expectedValues = { ...user }
                user.email = user.email?.toUpperCase()
                user.alternate_email = user.alternate_email?.toUpperCase()

                const input = userToUpdateUserInput(user)
                const result = cleanUpdateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.email).to.eq(expectedValues.email)
                expect(result.phone).to.eq(input.phone)
                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.eq(
                    expectedValues.alternate_email
                )
                expect(result.alternatePhone).to.eq(input.alternatePhone)
            })
        })

        context(
            'when input emails or phones have spaces at start and/or end',
            () => {
                it('fields should be trimmed', () => {
                    const user = createUser({
                        alternate_email: faker.internet.email().toLowerCase(),
                        alternate_phone: faker.phone.phoneNumber('+44#######'),
                    })

                    const expectedValues = { ...user }
                    user.email = ` ${user.email} `
                    user.phone = `  ${user.phone}  `
                    user.alternate_email = `   ${user.alternate_email}   `
                    user.alternate_phone = `    ${user.alternate_phone}    `

                    const input = userToUpdateUserInput(user)
                    const result = cleanUpdateUserInput(input)

                    validateNonCleanableFields(result, input)
                    expect(result.email).to.eq(expectedValues.email)
                    expect(result.phone).to.eq(expectedValues.phone)
                    expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                    expect(result.alternateEmail).to.eq(
                        expectedValues.alternate_email
                    )
                    expect(result.alternatePhone).to.eq(
                        expectedValues.alternate_phone
                    )
                })
            }
        )

        context('when input phones have dashes, spaces or parenthesis', () => {
            it('dashes, spaces and parenthesis should be removed', () => {
                const user = createUser({
                    phone: '+52 (378)-123-4567',
                    alternate_email: faker.internet.email().toLowerCase(),
                    alternate_phone: '+52 (378)-789-1234',
                })

                const input = userToUpdateUserInput(user)
                const result = cleanUpdateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.email).to.eq(input.email)
                expect(result.phone).to.eq('+523781234567')
                expect(result.dateOfBirth).to.eq(input.dateOfBirth)
                expect(result.alternateEmail).to.eq(input.alternateEmail)
                expect(result.alternatePhone).to.eq('+523787891234')
            })
        })

        context('when input date of birth has not leading zero', () => {
            it('leading zero should be added', () => {
                const user = createUser({
                    date_of_birth: '2/1996',
                    alternate_email: faker.internet.email().toLowerCase(),
                    alternate_phone: faker.phone.phoneNumber('+44#######'),
                })

                const input = userToUpdateUserInput(user)
                const result = cleanUpdateUserInput(input)

                validateNonCleanableFields(result, input)
                expect(result.email).to.eq(input.email)
                expect(result.phone).to.eq(input.phone)
                expect(result.dateOfBirth).to.eq('02/1996')
                expect(result.alternateEmail).to.eq(input.alternateEmail)
                expect(result.alternatePhone).to.eq(input.alternatePhone)
            })
        })
    })
})
