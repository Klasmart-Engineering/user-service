import { ValidationErrorItem } from 'joi'
import { customErrors } from '../../types/errors/customError'

interface ICustomMessage {
    code: string
    message: string
    params?: Record<string, unknown>
}

//
// mapping of Joi constraint to custom error message
// https://github.com/sideway/joi/blob/master/lib/types
//
export function getCustomConstraintDetails(
    error: ValidationErrorItem
): ICustomMessage {
    const constraintType = error.type

    // TODO add custom errors for other Joi constrains

    switch (constraintType) {
        case 'string.max': {
            return {
                code: customErrors.invalid_max_length.code,
                message: customErrors.invalid_max_length.message,
                params: {
                    max: error.context?.limit,
                },
            }
        }
        case 'string.min': {
            return {
                code: customErrors.invalid_min_length.code,
                message: customErrors.invalid_min_length.message,
                params: {
                    min: error.context?.limit,
                },
            }
        }

        case 'any.required':
        case 'string.base':
        case 'string.empty': {
            return {
                code: customErrors.missing_required_entity_attribute.code,
                message: customErrors.missing_required_entity_attribute.message,
            }
        }

        case 'string.email': {
            return {
                code: customErrors.invalid_email.code,
                message: customErrors.invalid_email.message,
            }
        }

        case 'string.alphanum': {
            return {
                code: customErrors.invalid_alphanumeric.code,
                message: customErrors.invalid_alphanumeric.message,
            }
        }

        case 'string.pattern.name': {
            const regexName = error.context?.name
            switch (regexName) {
                case 'date_mm_yyy': {
                    return {
                        code: customErrors.invalid_date.code,
                        message: customErrors.invalid_date.message,
                        params: {
                            format: 'MM-YYYY',
                        },
                    }
                }
                case 'phone': {
                    return {
                        code: customErrors.invalid_phone.code,
                        message: customErrors.invalid_phone.message,
                    }
                }
                case 'email': {
                    return {
                        code: customErrors.invalid_email.code,
                        message: customErrors.invalid_email.message,
                    }
                }
                case 'alphanum_with_special_characters': {
                    return {
                        code: customErrors.invalid_alphanumeric_special.code,
                        message:
                            customErrors.invalid_alphanumeric_special.message,
                    }
                }
                default: {
                    console.error(
                        `Missing custom message for joi regex constraint on property ${error.path}`
                    )
                    return {
                        code: customErrors.invalid_format.code,
                        message: error.message,
                    }
                }
            }
        }
        default: {
            console.error(
                `Missing custom message for joi constraint ${constraintType}`
            )
            return {
                code: customErrors.invalid_format.code,
                message: error.message,
            }
        }
    }
}
