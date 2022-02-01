import { ValidationErrorItem } from 'joi'
import logger from '../../logging'
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

    // first check for special cases identified via a custom message
    switch (error.message) {
        case 'email/phone is required': {
            return {
                code: customErrors.missing_required_either.code,
                message: customErrors.missing_required_either.message,
                params: {
                    otherAttribute: 'Phone',
                },
            }
        }
        case 'username/contactInfo is required': {
            return {
                code: customErrors.missing_required_either.code,
                message: customErrors.missing_required_either.message,
                params: {
                    otherAttribute: 'contactInfo',
                },
            }
        }
        case 'username/phone/email is required': {
            return {
                code: customErrors.missing_required_either.code,
                message: customErrors.missing_required_either.message,
                params: {
                    otherAttribute: 'Phone or Email',
                },
            }
        }
        default: {
            break
        }
    }

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
        case 'string.empty':
        case 'array.includesRequiredUnknowns': {
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
                    logger.error(
                        'Missing custom message for joi regex constraint on property %o',
                        error.path
                    )
                    return {
                        code: customErrors.invalid_format.code,
                        message: error.message,
                    }
                }
            }
        }

        case 'string.guid': {
            return {
                code: customErrors.invalid_uuid.code,
                message: customErrors.invalid_uuid.message,
            }
        }

        case 'array.unique': {
            return {
                code: customErrors.duplicate_attribute_values.code,
                message: customErrors.duplicate_attribute_values.message,
            }
        }

        default: {
            logger.error(
                'Missing custom message for joi constraint %s',
                constraintType
            )
            return {
                code: customErrors.invalid_format.code,
                message: error.message,
            }
        }
    }
}
