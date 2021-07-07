import csvErrorConstants from '../types/errors/csv/csvErrorConstants'
import { ValidationErrorItem } from 'joi'

export function getCustomConstraintDetails(error: ValidationErrorItem) {
    const constraintType = error.type
    const property = error.context?.key

    switch (constraintType) {
        case 'string.max': {
            return {
                code: csvErrorConstants.ERR_CSV_INVALID_LENGTH,
                message: csvErrorConstants.MSG_ERR_CSV_INVALID_LENGTH,
            }
        }
        case 'any.required': {
            return {
                code: csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
                message: csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            }
        }
        case 'string.email': {
            return {
                code: csvErrorConstants.ERR_CSV_INVALID_EMAIL,
                message: csvErrorConstants.MSG_ERR_CSV_INVALID_EMAIL,
            }
        }
        // testing async validators
        case 'any.example_async': {
            return {
                code: 'ASYNC_TEST_CODE',
                message: 'ASYNC_TEST_MESSAGE',
            }
        }
        // regex failures require property-specific messages
        case 'string.pattern.base': {
            switch (property) {
                case 'date_of_birth': {
                    return {
                        code: csvErrorConstants.ERR_CSV_INVALID_DATE_FORMAT,
                        message:
                            csvErrorConstants.MSG_ERR_CSV_INVALID_DATE_FORMAT,
                        params: {
                            format: 'MM-YYYY',
                        },
                    }
                }
                case 'phone': {
                    return {
                        code: csvErrorConstants.ERR_CSV_INVALID_PHONE,
                        message: csvErrorConstants.MSG_ERR_CSV_INVALID_PHONE,
                    }
                }
                default: {
                    return {
                        code: '',
                        message: '',
                    }
                }
            }
        }
        default: {
            return {
                code: '',
                message: '',
            }
        }
    }
}
