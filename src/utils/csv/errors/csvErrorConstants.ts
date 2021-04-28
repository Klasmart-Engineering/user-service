export default {
    // CSV Errors
    MSG_ERR_CSV_AT_ROW: "On row number {row}",

    ERR_CSV_EMPTY_FILE: "CSV_EMPTY_FILE",
    MSG_ERR_CSV_EMPTY_FILE: "{filename} is empty.",

    ERR_CSV_BAD_FORMAT: "CSV_BAD_FORMAT",

    ERR_CSV_MISSING_REQUIRED_FIELD: "CSV_MISSING_REQUIRED_FIELD",
    MSG_ERR_CSV_MISSING_REQUIRED: "{entity} {attribute} is required.", // For example: organization name is required.
    MSG_ERR_CSV_MISSING_REQUIRED_EITHER: "{entity} {attribute} or {other_entity} {other_attribute} is required.", // For example: organization name or subcategory name is required.

    ERR_CSV_DUPLICATE_ENTITY: "CSV_DUPLICATE_ENTITY",
    MSG_ERR_CSV_DUPLICATE_ENTITY: "\"{name}\" {entity} already exists.", // For example: "ABC" organization already exists.
    MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY: "\"{name}\" {entity} already exists for \"{parent_name}\" {parent_entity}.", // For example: "ABC" subcategory already exists for "DEF" category.

    ERR_CSV_NONE_EXISTING_ENTITY: "CSV_NONE_EXISTING_ENTITY",
    MSG_ERR_CSV_NONE_EXIST_ENTITY: "\"{name}\" {entity} doesn't exist.", // For example: "ABC" organization doesn't exist.
    MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY: "\"{name}\" {entity} doesn't exist for \"{parent_name}\" {parent_entity}",

    ERR_CSV_INVALID_FIELD: "CSV_INVALID_FIELD",
    MSG_ERR_CSV_INVALID_ENUM: "{entity} {attribute} must be one of these: {values}.",
    MSG_ERR_CSV_INVALID_MIN: "{entity} {attribute} must be at least {min}.",
    MSG_ERR_CSV_INVALID_MAX: "{entity} {attribute} must not be greater than {max}.",
    MSG_ERR_CSV_INVALID_BETWEEN: "{entity} {attribute} must be between {min} and {max}.",
    MSG_ERR_CSV_INVALID_ALPHA: "{entity} {attribute} must only contain letters.",
    MSG_ERR_CSV_INVALID_ALPHA_NUM: "{entity} {attribute} must only contain letters and numbers.",
    MSG_ERR_CSV_INVALID_DATE_FORMAT: "{entity} {attribute} does not match the format {format}.",
    MSG_ERR_CSV_INVALID_BOOLEAN: "{entity} {attribute} must be true or false.",
    MSG_ERR_CSV_INVALID_EMAIL: "{entity} {attribute} must be a valid email address.",
    MSG_ERR_CSV_INVALID_NUMBER: "{entity} {attribute} must be a number.",
    MSG_ERR_CSV_INVALID_UUID: "{entity} {attribute} must be a valid UUID.",
    MSG_ERR_CSV_INVALID_GREATER_THAN_OTHER: "{entity} {attribute} must be greater than {other}.",
    MSG_ERR_CSV_INVALID_DIFFERENT: "{entity} {attribute} and {other} must be different.",
    MSG_ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX: "{entity} {attribute} must only contain uppercase letters, numbers and must not greater than {max} characters.",
    MSG_ERR_CSV_INVALID_MULTIPLE_EXIST: "\"{name}\" {entity} matches {count}, it should match one {entity}.",
    MSG_ERR_CSV_INVALID_MULTIPLE_EXIST_CHILD: "\"{name}\" {entity} already exists more than once in \"{parent_name}\" {parent_entity}.",
    MSG_ERR_CSV_INVALID_LENGTH: "{entity} {attribute} must not be greater than {max} characters.",
} as const;
