import Joi from 'joi'
import { userValidations } from '../../../entities/validations/user'
import { APISchema, APISchemaMetadata } from '../../../types/api'
import { CreateUserInput } from '../../../types/graphQL/user'

export const createUserSchemaMetadata: APISchemaMetadata<CreateUserInput> = {
    contactInfo: {
        entity: 'User',
    },
    givenName: {
        entity: 'User',
    },
    familyName: {
        entity: 'User',
    },
    dateOfBirth: {
        entity: 'User',
    },
    username: {
        entity: 'User',
    },
    gender: {
        entity: 'User',
    },
    alternateEmail: {
        entity: 'User',
    },
    alternatePhone: {
        entity: 'User',
    },
}

export const createUserSchema: APISchema<CreateUserInput> = {
    contactInfo: Joi.object({
        email: userValidations.email,
        phone: userValidations.phone,
    }).required(),
    givenName: userValidations.given_name,
    familyName: userValidations.family_name,
    dateOfBirth: userValidations.date_of_birth,
    username: userValidations.username,
    gender: userValidations.gender,
    alternateEmail: userValidations.alternate_email,
    alternatePhone: userValidations.alternate_phone,
}
