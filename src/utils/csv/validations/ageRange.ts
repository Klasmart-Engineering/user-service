import { config } from '../../../config/config'
import { AgeRangeUnit } from '../../../entities/ageRangeUnit'
import { CSVError } from '../../../types/csv/csvError'
import csvErrorConstants from '../../../types/errors/csv/csvErrorConstants'
import { addCsvError } from '../csvUtils'

export function validateAgeRanges(
    rowErrors: CSVError[],
    rowNumber: number,
    age_range_low_value: string | undefined,
    age_range_high_value: string | undefined,
    age_range_unit: string | undefined
): void {
    const allAgeRangeFieldsExists =
        age_range_high_value && age_range_low_value && age_range_unit
    const noneOfAgeRangeFieldsExists =
        !age_range_high_value && !age_range_low_value && !age_range_unit
    if (!allAgeRangeFieldsExists && !noneOfAgeRangeFieldsExists) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_PROGRAM_AGE_RANGE_FIELDS_EXIST,
            rowNumber,
            'age_range_high_value, age_range_low_value, age_range_unit',
            csvErrorConstants.MSG_ERR_PROGRAM_AGE_RANGE_FIELDS_EXIST
        )
    }

    const lowValueNumber = Number(age_range_low_value)
    if (
        age_range_low_value &&
        (Number.isNaN(lowValueNumber) ||
            !Number.isInteger(lowValueNumber) ||
            lowValueNumber < config.limits.AGE_RANGE_LOW_VALUE_MIN ||
            lowValueNumber > config.limits.AGE_RANGE_LOW_VALUE_MAX)
    ) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_BETWEEN,
            rowNumber,
            'age_range_low_value',
            csvErrorConstants.MSG_ERR_CSV_INVALID_BETWEEN,
            {
                entity: 'ageRange',
                attribute: 'age_range_low_value',
                min: config.limits.AGE_RANGE_LOW_VALUE_MIN,
                max: config.limits.AGE_RANGE_LOW_VALUE_MAX,
            }
        )
    }

    const highValueNumber = Number(age_range_high_value)
    if (
        age_range_high_value &&
        (Number.isNaN(highValueNumber) ||
            !Number.isInteger(highValueNumber) ||
            highValueNumber < config.limits.AGE_RANGE_HIGH_VALUE_MIN ||
            highValueNumber > config.limits.AGE_RANGE_HIGH_VALUE_MAX)
    ) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_BETWEEN,
            rowNumber,
            'age_range_high_value',
            csvErrorConstants.MSG_ERR_CSV_INVALID_BETWEEN,
            {
                entity: 'ageRange',
                attribute: 'age_range_high_value',
                min: config.limits.AGE_RANGE_HIGH_VALUE_MIN,
                max: config.limits.AGE_RANGE_HIGH_VALUE_MAX,
            }
        )
    }

    if (
        age_range_low_value &&
        age_range_high_value &&
        lowValueNumber >= highValueNumber
    ) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_GREATER_THAN_OTHER,
            rowNumber,
            'age_range_low_value',
            csvErrorConstants.MSG_ERR_CSV_INVALID_GREATER_THAN_OTHER,
            {
                entity: 'ageRange',
                attribute: 'age_range_high_value',
                other: 'age_range_low_value',
            }
        )
    }

    if (
        age_range_unit &&
        age_range_unit !== AgeRangeUnit.MONTH &&
        age_range_unit !== AgeRangeUnit.YEAR
    ) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_ENUM,
            rowNumber,
            'age_range_low_value',
            csvErrorConstants.MSG_ERR_CSV_INVALID_ENUM,
            {
                entity: 'ageRange',
                attribute: 'age_range_unit',
                values: 'month, year',
            }
        )
    }
}
