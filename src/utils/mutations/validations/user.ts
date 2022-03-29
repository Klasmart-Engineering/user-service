import { sharedValidations } from '../../../entities/validations/shared'
import { UpdateUserInput } from '../../../types/graphQL/user'
import Joi from 'joi'
import { userValidations } from '../../../entities/validations/user'
import { APISchema } from '../../../types/api'
import { CreateUserInput } from '../../../types/graphQL/user'

export const createUserSchema: APISchema<CreateUserInput> = {
    contactInfo: Joi.object({
        email: userValidations.email,
        phone: userValidations.phone,
    }).optional(),
    givenName: userValidations.given_name,
    familyName: userValidations.family_name,
    dateOfBirth: userValidations.date_of_birth,
    username: userValidations.username.empty().when('contactInfo', {
        is: Joi.object().exist(),
        then: Joi.optional().allow('', null),
        otherwise: Joi.required().messages({
            'string.base': 'username/contactInfo is required',
            'any.required': 'username/contactInfo is required',
            'string.empty': 'username/contactInfo is required',
        }),
    }),
    gender: userValidations.gender,
    alternateEmail: userValidations.alternate_email,
    alternatePhone: userValidations.alternate_phone,
}

export const updateUserSchema: APISchema<UpdateUserInput> = {
    id: userValidations.user_id,
    email: sharedValidations.email,
    phone: sharedValidations.phone,
    givenName: userValidations.given_name.optional(),
    familyName: userValidations.family_name.optional(),
    dateOfBirth: userValidations.date_of_birth,
    username: userValidations.username,
    gender: userValidations.gender.optional(),
    alternateEmail: userValidations.alternate_email,
    alternatePhone: userValidations.alternate_phone,
    avatar: userValidations.avatar,
    primaryUser: userValidations.primaryUser,
}
