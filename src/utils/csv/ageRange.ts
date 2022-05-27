import { EntityManager } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Organization } from '../../entities/organization'
import { AgeRangeRow } from '../../types/csv/ageRangeRow'
import { addCsvError } from './csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import { config } from '../../config/config'
import { Status } from '../../entities/status'
import { PermissionName } from '../../permissions/permissionNames'
import { customErrors } from '../../types/errors/customError'

export const processAgeRangeFromCSVRow = async (
    manager: EntityManager,
    row: AgeRangeRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    let ageRange: AgeRange | undefined | null

    const {
        organization_name,
        age_range_low_value,
        age_range_high_value,
        age_range_unit,
    } = row

    if (!organization_name) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'organization_name',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!age_range_low_value) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'age_range_low_value',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'ageRange',
                attribute: 'age_range_low_value',
            }
        )
    }

    if (!age_range_high_value) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'age_range_high_value',
            customErrors.missing_required_entity_attribute.message,
            {
                entity: 'ageRange',
                attribute: 'age_range_high_value',
            }
        )
    }

    if (!age_range_unit) {
        addCsvError(
            rowErrors,
            customErrors.missing_required_entity_attribute.code,
            rowNumber,
            'age_range_unit',
            customErrors.missing_required_entity_attribute.message,
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

    if (
        Number.isNaN(highValueNumber) ||
        !Number.isInteger(highValueNumber) ||
        highValueNumber < 1 ||
        highValueNumber > 99
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

    if (lowValueNumber >= highValueNumber) {
        addCsvError(
            rowErrors,
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
            rowErrors,
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
        return rowErrors
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entityName: organization_name,
                entity: 'organization',
            }
        )
        return rowErrors
    }

    // Is the user authorized to upload age ranges to this org
    if (
        !(await userPermissions.allowed(
            { organization_ids: [organization.organization_id] },
            PermissionName.create_age_range_20222
        ))
    ) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'age range',
                organizationName: organization.organization_name,
            }
        )
        return rowErrors
    }

    const age_range_name = `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`
    ageRange = await manager.findOne(AgeRange, {
        where: {
            name: age_range_name,
            low_value: Number(age_range_low_value),
            high_value: Number(age_range_high_value),
            high_value_unit: age_range_unit,
            low_value_unit: age_range_unit,
            system: false,
            status: Status.ACTIVE,
            organization: { organization_id: organization?.organization_id },
        },
    })

    if (ageRange) {
        addCsvError(
            rowErrors,
            customErrors.existent_child_entity.code,
            rowNumber,
            'organization_name',
            customErrors.existent_child_entity.message,
            {
                entityName: age_range_name,
                entity: 'ageRange',
                parentName: organization_name,
                parentEntity: 'organization',
            }
        )
    }

    // Return if there are any errors
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    ageRange = new AgeRange()
    ageRange.name = age_range_name
    ageRange.low_value = lowValueNumber
    ageRange.high_value = highValueNumber
    ageRange.low_value_unit = ageRangeUnitValue
    ageRange.high_value_unit = ageRangeUnitValue
    ageRange.organization = Promise.resolve(organization)

    await manager.save(ageRange)

    return rowErrors
}
