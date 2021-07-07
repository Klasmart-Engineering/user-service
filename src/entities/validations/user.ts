import Joi, { ValidationError, ValidationErrorItem } from 'joi'
import { User } from '../user'
import validationConstants from '../../utils/csv/validationConstants'

export const userValidationSchema = Joi.object<User>({
    given_name: Joi.string()
        .required()
        .max(validationConstants.USER_GIVEN_NAME_MAX_LENGTH),

    family_name: Joi.string()
        .required()
        .max(validationConstants.USER_FAMILY_NAME_MAX_LENGTH),

    email: Joi.string()
        .when('phone', {
            is: Joi.string().required(),
            then: Joi.optional(),
            otherwise: Joi.required(),
        })
        .email(),

    phone: Joi.string()
        .optional()
        .regex(/^\++?[1-9][0-9]\d{6,14}$/), // joi doesn't provide a phone() validator
    // .when('email', { is: undefined, then: Joi.required() }), // can't do this - circular dependency

    date_of_birth: Joi.string().regex(/^(((0)[0-9])|((1)[0-2]))(-)\d{4}$/),

    // TEST OF CUSTOM ASYNC VALIDATORS
    // NB: external validations are only called if the schema validation passes
    // https://joi.dev/api/?v=17.4.0#anyexternalmethod-description
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gender: (Joi.string() as any).external(async (value: unknown) => {
        return new Promise((resolve, reject) =>
            setTimeout(() => {
                // simulate a validation error
                const item: ValidationErrorItem = {
                    type: 'any.example_async',
                    message: 'async thing failed',
                    path: ['gender'],
                    context: {
                        key: 'gender',
                    },
                }

                const error = new ValidationError(item.message, [item], value)
                reject(error)
            }, 10)
        )
    }),
})

export async function validateUser(
    user: User
): Promise<ValidationError | undefined> {
    try {
        await userValidationSchema.validateAsync(user, {
            allowUnknown: true,
            abortEarly: false,
        })
    } catch (e) {
        return e
    }
}
