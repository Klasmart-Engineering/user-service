
//
// TODO
// Deprecate and use new error codes & messages in customErrors.ts
//
export default {
    MSG_ERR_CSV_AT_ROW: "On row number {row}",

    ERR_CSV_EMPTY_FILE: "ERR_CSV_EMPTY_FILE",
    MSG_ERR_CSV_EMPTY_FILE: "{filename} is empty.",

    ERR_CSV_BAD_INPUT: "ERR_CSV_BAD_INPUT",

    ERR_CSV_MISSING_REQUIRED: "ERR_CSV_MISSING_REQUIRED",
    MSG_ERR_CSV_MISSING_REQUIRED: "{entity} {attribute} is required.", // For example: organization name is required.

    ERR_CSV_MISSING_REQUIRED_EITHER: "ERR_CSV_MISSING_REQUIRED_EITHER",
    MSG_ERR_CSV_MISSING_REQUIRED_EITHER: "{entity} {attribute} or {other_entity} {other_attribute} is required.", // For example: organization name or subcategory name is required.

    ERR_CSV_DUPLICATE_ENTITY: "ERR_CSV_DUPLICATE_ENTITY",
    MSG_ERR_CSV_DUPLICATE_ENTITY: "\"{name}\" {entity} already exists.", // For example: "ABC" organization already exists.

    ERR_CSV_DUPLICATE_CHILD_ENTITY: "ERR_CSV_DUPLICATE_CHILD_ENTITY",
    MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY: "\"{name}\" {entity} already exists for \"{parent_name}\" {parent_entity}.", // For example: "ABC" subcategory already exists for "DEF" category.

    ERR_CSV_NONE_EXIST_ENTITY: "ERR_CSV_NONE_EXIST_ENTITY",
    MSG_ERR_CSV_NONE_EXIST_ENTITY: "\"{name}\" {entity} doesn't exist.", // For example: "ABC" organization doesn't exist.

    ERR_CSV_NONE_EXIST_CHILD_ENTITY: "ERR_CSV_NONE_EXIST_CHILD_ENTITY",
    MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY: "\"{name}\" {entity} doesn't exist for \"{parent_name}\" {parent_entity}",

    ERR_CSV_INVALID_FIELD: "ERR_CSV_INVALID_FIELD",

    ERR_PROGRAM_AGE_RANGE_FIELDS_EXIST: "ERR_PROGRAM_AGE_RANGE_FIELD_EXIST",
    MSG_ERR_PROGRAM_AGE_RANGE_FIELDS_EXIST: "program must exist age_range_high_value, age_range_low_value, age_range_unit or none of them.",

    ERR_ONE_ACTIVE_ORGANIZATION_PER_USER: "ERR_ONE_ACTIVE_ORGANIZATION_PER_USER",
    MSG_ERR_ONE_ACTIVE_ORGANIZATION_PER_USER: "only one active organization per user.",

    ERR_CSV_INVALID_ENUM: "ERR_CSV_INVALID_ENUM",
    MSG_ERR_CSV_INVALID_ENUM: "{entity} {attribute} must be one of these: {values}.",

    ERR_CSV_INVALID_MIN: "ERR_CSV_INVALID_MIN",
    MSG_ERR_CSV_INVALID_MIN: "{entity} {attribute} must be at least {min}.",

    ERR_CSV_INVALID_MAX: "ERR_CSV_INVALID_MAX",
    MSG_ERR_CSV_INVALID_MAX: "{entity} {attribute} must not be greater than {max}.",

    ERR_CSV_INVALID_BETWEEN: "ERR_CSV_INVALID_BETWEEN",
    MSG_ERR_CSV_INVALID_BETWEEN: "{entity} {attribute} must be between {min} and {max}.",

    ERR_CSV_INVALID_ALPHA: "ERR_CSV_INVALID_ALPHA",
    MSG_ERR_CSV_INVALID_ALPHA: "{entity} {attribute} must only contain letters.",

    ERR_CSV_INVALID_ALPHA_NUM: "ERR_CSV_INVALID_ALPHA_NUM",
    MSG_ERR_CSV_INVALID_ALPHA_NUM: "{entity} {attribute} must only contain letters and numbers.",

    ERR_CSV_INVALID_DATE_FORMAT: "ERR_CSV_INVALID_DATE_FORMAT",
    MSG_ERR_CSV_INVALID_DATE_FORMAT: "{entity} {attribute} does not match the format {format}.",

    ERR_CSV_INVALID_BOOLEAN: "ERR_CSV_INVALID_BOOLEAN",
    MSG_ERR_CSV_INVALID_BOOLEAN: "{entity} {attribute} must be true or false.",

    ERR_CSV_INVALID_EMAIL: "ERR_CSV_INVALID_EMAIL",
    MSG_ERR_CSV_INVALID_EMAIL: "{entity} {attribute} must be a valid email address.",

    ERR_CSV_INVALID_PHONE: "ERR_CSV_INVALID_PHONE",
    MSG_ERR_CSV_INVALID_PHONE: "{entity} {attribute} must be a valid phone number.",

    ERR_CSV_INVALID_NUMBER: "ERR_CSV_INVALID_NUMBER",
    MSG_ERR_CSV_INVALID_NUMBER: "{entity} {attribute} must be a number.",

    ERR_CSV_INVALID_UUID: "ERR_CSV_INVALID_UUID",
    MSG_ERR_CSV_INVALID_UUID: "{entity} {attribute} must be a valid UUID.",

    ERR_CSV_INVALID_GREATER_THAN_OTHER: "ERR_CSV_INVALID_GREATER_THAN_OTHER",
    MSG_ERR_CSV_INVALID_GREATER_THAN_OTHER: "{entity} {attribute} must be greater than {other}.",

    ERR_CSV_INVALID_DIFFERENT: "ERR_CSV_INVALID_DIFFERENT",
    MSG_ERR_CSV_INVALID_DIFFERENT: "{entity} {attribute} and {other} must be different.",

    ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX: "ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX",
    MSG_ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX: "{entity} {attribute} must only contain uppercase letters, numbers and must not greater than {max} characters.",

    ERR_CSV_INVALID_MULTIPLE_EXIST: "ERR_CSV_INVALID_MULTIPLE_EXIST",
    MSG_ERR_CSV_INVALID_MULTIPLE_EXIST: "\"{name}\" {entity} matches {count}, it should match one {entity}.",

    ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD: "ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD",
    MSG_ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD: "\"{name}\" {entity} already exists more than once in \"{parent_name}\" {parent_entity}.",

    ERR_CSV_INVALID_LENGTH: "ERR_CSV_INVALID_LENGTH",
    MSG_ERR_CSV_INVALID_LENGTH: "{entity} {attribute} must not be greater than {max} characters."
} as const;