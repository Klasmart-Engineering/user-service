import { expect } from 'chai'
import faker from 'faker'
import Joi from 'joi'
import { inviteUserSchema } from '../../../src/operations/organization'
import { arraySchemaContext, expectValidationErrors } from '../../utils/joi'
import { validUser } from '../../utils/testEntities'

context('inviteUser', () => {
    const schema = Joi.object(inviteUserSchema)
    const validate = (data: Record<string, unknown>) => {
        return schema.validate(data, { abortEarly: false })
    }

    const required = {
        given_name: validUser.given_name,
        family_name: validUser.family_name,
        gender: validUser.gender,
        organization_role_ids: [faker.datatype.uuid()],
    }

    it('fails validation if missing all required fields', () => {
        const { error } = validate({
            email: '',
            phone: '',
            given_name: '',
            family_name: '',
            date_of_birth: '',
            username: '',
            gender: '',
            shortcode: '',
            organization_role_ids: [],
            school_ids: [],
            school_role_ids: [],
            alternate_email: '',
            alternate_phone: '',
        })
        expectValidationErrors(error, [
            {
                label: 'email',
                type: 'string.empty',
            },
            { label: 'given_name', type: 'string.empty' },
            { label: 'family_name', type: 'string.empty' },
            { label: 'gender', type: 'string.empty' },
            {
                label: 'organization_role_ids',
                type: 'array.includesRequiredUnknowns',
            },
        ])
    })

    it('fails validation if only the static required properties are provided', () => {
        const { error } = validate(required)
        expectValidationErrors(error, [
            { label: 'email', type: 'any.required' },
        ])
    })
    ;[
        { email: validUser.email },
        { phone: validUser.phone },
        { email: validUser.email, phone: validUser.phone },
    ].forEach((optionallyRequired) => {
        it(`passes validation if static and optionally required (${JSON.stringify(
            optionallyRequired
        )}}) properties are provided`, () => {
            const { error } = validate({ ...required, ...optionallyRequired })
            expect(error).to.be.undefined
        })
    })

    context('school_ids', () => {
        const school_ids = arraySchemaContext(inviteUserSchema.school_role_ids)

        school_ids.optional()
        school_ids.only.uuid()
    })

    context('organization_role_ids', () => {
        const organization_role_ids = arraySchemaContext(
            inviteUserSchema.organization_role_ids
        )

        organization_role_ids.required()
        organization_role_ids.only.uuid()
    })

    context('school_role_ids', () => {
        const school_role_ids = arraySchemaContext(
            inviteUserSchema.school_role_ids
        )

        school_role_ids.optional()
        school_role_ids.only.uuid()
    })
})
