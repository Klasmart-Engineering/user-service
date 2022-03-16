import { expect } from 'chai'
import faker from 'faker'
import {
    addIdentifierToKey,
    buildConflictingUserKey,
    ConflictingUserKey,
    createUserInputToConflictingUserKey,
} from '../../../src/resolvers/user'
import { CreateUserInput } from '../../../src/types/graphQL/user'

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
})
