import { CSVErrorParams } from '../csv/csvError'

export const genericErrorCodes = [
    'duplicate_entity',
    'duplicate_child_entity',
    'duplicate_attribute_values',
    'nonexistent_entity',
    'nonexistent_child',
    'missing_required_entity_attribute',
    'missing_required_either',
    'invalid_max_length',
    'invalid_min_length',
    'invalid_alphanumeric_special',
    'invalid_alpha',
    'invalid_alphanumeric',
    'invalid_email',
    'invalid_phone',
    'invalid_date',
    'invalid_uuid',
    'unauthorized',
    'invalid_format',
    'inactive_status',
    'invalid_operation_type',
    'delete_rejected_entity_in_use',
    'nonexistent_or_inactive',
] as const

export type GenericErrorCode = typeof genericErrorCodes[number]

export interface CustomError {
    code: string
    message: string
    params: Record<string, unknown>
}

export function getCustomErrorMessageVariables(message: string) {
    return (message.match(/(?<={)(.*?)(?=})/g) ||
        []) as (keyof CSVErrorParams)[]
}

export const customErrors = {
    // files (generic)
    empty_file: {
        code: 'ERR_EMPTY_FILE',
        message: 'The {fileName} file is empty.',
    },
    invalid_file_type: {
        code: 'ERR_INVALID_FILE_TYPE',
        message: 'File must be in {fileType} format.',
    },
    upload_max_file_count: {
        code: 'ERR_UPLOAD_EXCEEDS_MAX_FILE_COUNT',
        message: 'Only {max} can be uploaded at a time.',
    },
    invalid_file_max_size: {
        code: 'ERR_FILE_EXCEEDS_MAX_FILE_SIZE',
        message: 'File size ({max}) exceeds max file size ({size})',
    },

    // files (csv)
    csv_bad_input: {
        code: 'ERR_CSV_BAD_INPUT',
        message: 'ERR_CSV_BAD_INPUT',
    },
    csv_missing_required_column: {
        code: 'ERR_CSV_MISSING_REQUIRED_COLUMN',
        message: '{fileName} is missing {columnName} column header.',
    },
    csv_duplicate_column: {
        code: 'ERR_CSV_DUPLICATE_COLUMN',
        message: '{fileName} contains duplicate {columnName} column header.',
    },

    // generic
    duplicate_entity: {
        code: 'ERR_DUPLICATE_ENTITY',
        message: '{entity} {entityName} already exists.',
    },
    duplicate_child_entity: {
        code: 'ERR_DUPLICATE_CHILD_ENTITY',
        message:
            '{entity} {entityName} already exists for {parentEntity} {parentName}.',
    },
    duplicate_input_value: {
        code: 'ERR_DUPLICATE_INPUT_VALUE',
        message: '{entity} {entityName} is repeated in the inputs.',
    },
    duplicate_attribute_values: {
        code: 'ERR_DUPLICATE_ATTRIBUTE_VALUES',
        message: '{entity} {attribute} must contain unique values.',
    },
    nonexistent_entity: {
        code: 'ERR_NON_EXISTENT_ENTITY',
        message: "{entity} {entityName} doesn't exist.",
    },
    nonexistent_child: {
        code: 'ERR_NON_EXISTENT_CHILD_ENTITY',
        message:
            "{entity} {entityName} doesn't exist for {parentEntity} {parentName}.",
    },
    missing_required_entity_attribute: {
        code: 'ERR_MISSING_REQUIRED_ENTITY_ATTRIBUTE',
        message: '{entity} {attribute} is required.',
    },
    missing_required_either: {
        code: 'ERR_MISSING_REQUIRED_EITHER',
        message: '{entity} {attribute}/{otherAttribute} is required.',
    },

    invalid_max_length: {
        code: 'ERR_INVALID_MAX_LENGTH',
        message:
            '{entity} {attribute} must not be greater than {max} characters.',
    },
    invalid_min_length: {
        code: 'ERR_INVALID_MIN_LENGTH',
        message: '{entity} {attribute} must not be less than {min} characters.',
    },
    invalid_array_max_length: {
        code: 'ERR_INVALID_ARRAY_MAX_LENGTH',
        message:
            '{entity} {attribute} must not be greater than {max} elements.',
    },
    invalid_array_min_length: {
        code: 'ERR_INVALID_ARRAY_MIN_LENGTH',
        message: '{entity} {attribute} must not be less than {min} elements.',
    },
    invalid_alphanumeric_special: {
        code: 'ERR_INVALID_ALPHANUMERIC_SPECIAL_CHARACTERS',
        message:
            '{entity} {attribute} must only contain letters, numbers, space and & / , - .',
    },
    invalid_alpha: {
        code: 'ERR_INVALID_ALPHABETIC',
        message: '{entity} {attribute} must only contain letters.',
    },
    invalid_alphanumeric: {
        code: 'ERR_INVALID_ALPHANUMERIC',
        message: '{entity} {attribute} must only contain letters and numbers.',
    },
    invalid_email: {
        code: 'ERR_INVALID_EMAIL',
        message: 'Must be a valid email in format yourname@example.com',
    },
    invalid_phone: {
        code: 'ERR_INVALID_PHONE',
        message: 'Invalid phone number.',
    },
    invalid_date: {
        code: 'ERR_INVALID_DATE',
        message: '{entity} {attribute} does not match the format {format}.',
    },
    invalid_uuid: {
        code: 'ERR_INVALID_UUID',
        message: '{entity} {attribute} must be a valid UUID.',
    },
    invalid_operation_type: {
        code: 'ERR_INVALID_OPERATION_TYPE',
        message:
            'Operation type was {attribute}, but a {otherAttribute} was expected',
    },
    inactive_status: {
        code: 'ERR_INACTIVE_STATUS',
        message: '{entity} {entityName} is inactive.',
    },
    nonexistent_or_inactive: {
        code: 'ERR_NONEXISTENT_ENTITY_OR_INACTIVE_STATUS',
        message:
            'No active {entity} was found with {attribute} {otherAttribute}.',
    },
    requires_at_least_one: {
        code: 'ERR_REQUIRES_AT_LEAST_ONE',
        message:
            '{entity} {attribute} requires at least one of the following fields: ({fields}).',
    },

    // auth
    unauthorized: {
        code: 'UNAUTHORIZED',
        message: 'You are unauthorized to perform this action.',
    },
    unauthorized_org_upload: {
        code: 'UNAUTHORIZED_UPLOAD_TO_ORGANIZATION',
        message:
            'Unauthorized to upload {entity} to organization {organizationName}.',
    },
    unauthorized_upload_child: {
        code: 'UNAUTHORIZED_UPLOAD_CHILD_ENTITY',
        message:
            'Unauthorized to upload {entity} to {parentEntity} "{parentName}".',
    },
    missing_token: {
        code: 'UNAUTHORIZED',
        message: `No authentication token provided. 
                Please login to the hub to refresh the cookie, 
                or provide a token in the Authorization header.`,
    },

    // generic fallback if a joi constraint is not overridden
    // see messages.ts
    invalid_format: {
        code: 'ERR_INVALID_FORMAT',
    },

    // validation on database operations
    delete_rejected_entity_in_use: {
        code: 'ERR_DELETE_REJECTED_ENTITY_IN_USE',
        message: 'Cannot delete {entity} {entityName} since it is being used',
    },

    mutation_bad_input: {
        code: 'MUTATION_BAD_INPUT',
        message: 'Cannot set {entity} index {index} attribute {attribute}',
    },

    database_save_error: {
        code: 'ERROR_SAVING',
        message: 'Cannot save to database',
    },
}
