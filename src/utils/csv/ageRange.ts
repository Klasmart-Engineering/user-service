import { EntityManager } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Organization } from '../../entities/organization'
import { AgeRangeRow } from '../../types/csv/ageRangeRow'
import { addCsvError } from './csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import validationConstants from '../../entities/validations/constants'

export async function processAgeRangeFromCSVRow(
    manager: EntityManager,
    row: AgeRangeRow,
    rowNumber: number,
    fileErrors: CSVError[]
) {
    let ageRange: AgeRange | undefined

    const {
        organization_name,
        age_range_low_value,
        age_range_high_value,
        age_range_unit,
    } = row

    if (!organization_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!age_range_low_value) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'age_range_low_value',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'ageRange',
                attribute: 'age_range_low_value',
            }
        )
    }

    if (!age_range_high_value) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'age_range_high_value',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'ageRange',
                attribute: 'age_range_high_value',
            }
        )
    }

    if (!age_range_unit) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'age_range_unit',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'ageRange',
                attribute: 'age_range_unit',
            }
        )
    }

    const highValueNumber = Number(age_range_high_value)
    const lowValueNumber = Number(age_range_low_value)
    const ageRangeUnitValue = age_range_unit as AgeRangeUnit

    if (
        Number.isNaN(lowValueNumber) ||
        !Number.isInteger(lowValueNumber) ||
        lowValueNumber < 0 ||
        lowValueNumber > 99
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_BETWEEN,
            rowNumber,
            'age_range_low_value',
            csvErrorConstants.MSG_ERR_CSV_INVALID_BETWEEN,
            {
                entity: 'ageRange',
                attribute: 'age_range_low_value',
                min: validationConstants.AGE_RANGE_LOW_VALUE_MIN,
                max: validationConstants.AGE_RANGE_LOW_VALUE_MAX,
            }
        )
    }

    if (
        Number.isNaN(highValueNumber) ||
        !Number.isInteger(highValueNumber) ||
        highValueNumber < 1 ||
        highValueNumber > 99
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_BETWEEN,
            rowNumber,
            'age_range_high_value',
            csvErrorConstants.MSG_ERR_CSV_INVALID_BETWEEN,
            {
                entity: 'ageRange',
                attribute: 'age_range_high_value',
                min: validationConstants.AGE_RANGE_HIGH_VALUE_MIN,
                max: validationConstants.AGE_RANGE_HIGH_VALUE_MAX,
            }
        )
    }

    if (lowValueNumber >= highValueNumber) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_GREATER_THAN_OTHER,
            rowNumber,
            'age_range_high_value',
            csvErrorConstants.MSG_ERR_CSV_INVALID_GREATER_THAN_OTHER,
            {
                entity: 'ageRange',
                attribute: 'age_range_high_value',
                other: 'age_range_low_value',
            }
        )
    }

    if (
        age_range_unit !== AgeRangeUnit.MONTH &&
        age_range_unit !== AgeRangeUnit.YEAR
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_ENUM,
            rowNumber,
            'age_range_unit',
            csvErrorConstants.MSG_ERR_CSV_INVALID_ENUM,
            {
                entity: 'ageRange',
                attribute: 'age_range_unit',
                values: 'month, year',
            }
        )
        return
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )
    }

    const age_range_name = `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`
    ageRange = await manager.findOne(AgeRange, {
        where: {
            name: age_range_name,
            low_value: age_range_low_value,
            high_value: age_range_high_value,
            high_value_unit: age_range_unit,
            low_value_unit: age_range_unit,
            system: false,
            status: 'active',
            organization,
        },
    })

    if (ageRange) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                name: age_range_name,
                entity: 'ageRange',
                parent_name: organization_name,
                parent_entity: 'organization',
            }
        )
    }

    // Return if there are any errors
    if ((fileErrors && fileErrors.length > 0) || !organization) {
        return
    }

    ageRange = new AgeRange()
    ageRange.name = age_range_name
    ageRange.low_value = lowValueNumber
    ageRange.high_value = highValueNumber
    ageRange.low_value_unit = ageRangeUnitValue
    ageRange.high_value_unit = ageRangeUnitValue
    ageRange.organization = Promise.resolve(organization)

    await manager.save(ageRange)
}
