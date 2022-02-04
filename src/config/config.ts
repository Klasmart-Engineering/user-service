import logger from '../logging'

export const config = {
    limits: {
        MUTATION_MIN_INPUT_ARRAY_SIZE: 1,
        MUTATION_MAX_INPUT_ARRAY_SIZE: 50,
        AGE_RANGE_LOW_VALUE_MIN: 0,
        AGE_RANGE_LOW_VALUE_MAX: 99,
        AGE_RANGE_HIGH_VALUE_MIN: 1,
        AGE_RANGE_HIGH_VALUE_MAX: 99,
        ORGANIZATION_NAME_MAX_LENGTH: 30,
        CLASS_NAME_MAX_LENGTH: 45,
        SCHOOL_NAME_MAX_LENGTH: 120,
        USER_GIVEN_NAME_MAX_LENGTH: 100,
        USER_FAMILY_NAME_MAX_LENGTH: 100,
        EMAIL_MAX_LENGTH: 250,
        ROLE_NAME_MAX_LENGTH: 20,
        SHORTCODE_MAX_LENGTH: 16,
        SCHOOL_SHORTCODE_MAX_LENGTH: 10,
        GENDER_MIN_LENGTH: 3,
        GENDER_MAX_LENGTH: 16,
        USERNAME_MAX_LEN: 35,
        AVATAR_MAX_LEN: 8192,
        CSV_MAX_FILESIZE: 50 * 1024,
    },
} as const

export const getEnvVar = (name: string, defaultValue?: string): string | undefined => {
    const val = process.env[name]

    if (val) {
        return val
    } else {
        logger.warn(
            `Env Variable not set: "${name}" - defaulting to "${defaultValue}"`
        )
        return defaultValue
    }
}