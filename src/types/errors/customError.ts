export interface CustomError {
    code: string
    message: string
    params: Record<string, unknown>
}

export function getCustomErrorMessageVariables(message: string) {
    return message.match(/(?<={)(.*?)(?=})/g) || []
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

    // auth
    unauthorized: {
        code: 'UNAUTHORIZED',
        message: 'You are unauthorized to perform this action.',
    },
    unauthorized_org_upload: {
        code: 'UNAUTHORIZED_UPLOAD_TO_ORGANIZATION',
        message:
            'Unauthorized to upload {entity} to organization ${organizationName}.',
    },

    // generic fallback if a joi constraint is not overridden
    // see messages.ts
    invalid_format: {
        code: 'ERR_INVALID_FORMAT',
    },
}
