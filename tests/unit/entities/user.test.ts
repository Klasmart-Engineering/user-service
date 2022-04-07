import { expect } from 'chai'
import { DataSource, EntityManager } from 'typeorm'
import faker from 'faker'

import { createTestConnection } from '../../utils/testConnection'
import { createUser } from '../../factories/user.factory'
import { User } from '../../../src/entities/user'
import { userValidations } from '../../../src/entities/validations/user'
import Joi from 'joi'
import { permutationsWithRepetition } from '../../utils/permute'
import { expectValidationErrors } from '../../utils/joi'
import { truncateTables } from '../../utils/database'

describe('User', () => {
    let dataSource: DataSource
    let manager: EntityManager
    let user: User

    before(async () => {
        dataSource = await createTestConnection()
        manager = dataSource.manager
    })

    after(async () => {
        await dataSource?.close()
    })

    beforeEach(async () => {
        user = createUser()
    })

    afterEach(async () => {
        await truncateTables(dataSource)
    })

    describe('.new', () => {
        context('when all details are correct', () => {
            beforeEach(async () => {
                await manager.save(user)
            })

            it('creates the OrganizationOwnership', async () => {
                const dbUser = await User.findOneOrFail({
                    where: {
                        user_id: user.user_id,
                    },
                })

                expect(dbUser.user_id).to.eq(user.user_id)
                expect(dbUser.given_name).to.eq(user.given_name)
                expect(dbUser.family_name).to.eq(user.family_name)
                expect(dbUser.full_name()).to.eq(
                    `${user.given_name} ${user.family_name}`
                )
                expect(dbUser.email).to.eq(user.email)
                expect(dbUser.username).to.eq(user.username)
            })
        })
    })
})

describe('userValidations', () => {
    describe('email or phone', () => {
        const schema = Joi.object({
            email: userValidations.email,
            phone: userValidations.phone,
        })
        const validate = (data: Record<string, unknown>) => {
            return schema.validate(data, { abortEarly: false })
        }

        permutationsWithRepetition(['', undefined, null], 2).forEach(
            ([email, phone]) => {
                it(`fails validation when email='${email}' and phone='${phone}'`, () => {
                    const { error } = validate({ email, phone })
                    expect(error?.details).to.have.length(1)
                    expect(error?.details[0]?.context?.key).to.equal('email')
                    expect(error?.details[0]?.message).to.equal(
                        'email/phone is required'
                    )
                })
            }
        )
        ;['', undefined, null].forEach((phone) => {
            it(`fails validation when email isn't a valid email format and phone='${phone}'`, () => {
                const { error } = validate({ email: 'not-an-email', phone })
                expectValidationErrors(error, [
                    { label: 'email', type: 'string.pattern.name' },
                ])
            })

            it(`fails validation when email is too long and phone='${phone}'`, () => {
                const { error } = validate({
                    email: `${faker.random.alpha({ count: 250 })}@gmail.com`,
                    phone,
                })
                expectValidationErrors(error, [
                    { label: 'email', type: 'string.max' },
                ])
            })

            it(`passes validation when email is valid and phone='${phone}'`, () => {
                const { error } = validate({ email: 'joe@calmid.com', phone })
                expect(error).to.be.undefined
            })
        })
        ;['', undefined, null].forEach((email) => {
            it(`fails validation when phone isn't a valid phone format and email='${email}'`, () => {
                const { error } = validate({ email, phone: 'not-a-phone' })
                expectValidationErrors(error, [
                    { label: 'phone', type: 'string.pattern.name' },
                ])
            })

            it(`passes validation when phone is valid and email='${email}'`, () => {
                const { error } = validate({ email, phone: '+4412345678910' })
                expect(error).to.be.undefined
            })
        })

        it('fails validation when both email and phone are not a valid format', () => {
            const { error } = validate({
                email: 'not-an-email',
                phone: 'not-a-phone',
            })
            expectValidationErrors(error, [
                { label: 'email', type: 'string.pattern.name' },
                { label: 'phone', type: 'string.pattern.name' },
            ])
        })

        it(`passes validation when both email and phone are valid`, () => {
            const { error } = validate({
                email: 'joe@calmid.com',
                phone: '+4412345678910',
            })
            expect(error).to.be.undefined
        })
    })
})
