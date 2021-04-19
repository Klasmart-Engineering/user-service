import { EntityManager } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Organization } from '../../entities/organization'
import { AgeRangeRow } from '../../types/csv/ageRangeRow'
import { saveError } from './readFile'

export async function processAgeRangeFromCSVRow(
    manager: EntityManager,
    row: AgeRangeRow,
    rowNumber: number,
    fileErrors: string[]
) {
    let ageRange: AgeRange | undefined

    const {
        organization_name,
        age_range_low_value,
        age_range_high_value,
        age_range_unit,
    } = row

    const requiredFieldsAreProvided =
        organization_name &&
        age_range_low_value &&
        age_range_high_value &&
        age_range_unit

    if (!organization_name) {
        saveError(fileErrors, rowNumber, 'Organization name is not provided')
    }

    if (!age_range_low_value) {
        saveError(fileErrors, rowNumber, 'Age range low value is not provided')
    }

    if (!age_range_high_value) {
        saveError(fileErrors, rowNumber, 'Age range high value is not provided')
    }

    if (!age_range_unit) {
        saveError(fileErrors, rowNumber, 'Age range unit is not provided')
    }

    if (!requiredFieldsAreProvided) {
        return
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
        saveError(
            fileErrors,
            rowNumber,
            'age_range_low_value should be an integer number greater or equal to 0 and lower than 100'
        )

        return
    }

    if (
        Number.isNaN(highValueNumber) ||
        !Number.isInteger(highValueNumber) ||
        highValueNumber < 1 ||
        highValueNumber > 99
    ) {
        saveError(
            fileErrors,
            rowNumber,
            'age_range_high_value should be an integer number greater than 0 and lower than 100'
        )

        return
    }

    if (lowValueNumber >= highValueNumber) {
        saveError(
            fileErrors,
            rowNumber,
            'age_range_high_value should be greater than age_range_low_value'
        )
    }

    if (
        age_range_unit !== AgeRangeUnit.MONTH &&
        age_range_unit !== AgeRangeUnit.YEAR
    ) {
        saveError(
            fileErrors,
            rowNumber,
            "age_range_unit should be 'month' or 'year'"
        )
        return
    }

    const organization = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (!organization) {
        saveError(
            fileErrors,
            rowNumber,
            `Provided organization with name '${organization_name}' doesn't exists`
        )

        return
    }

    ageRange = await manager.findOne(AgeRange, {
        where: {
            name: `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`,
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
        saveError(
            fileErrors,
            rowNumber,
            'Provided age range already exists in the provided organization'
        )

        return
    }

    ageRange = new AgeRange()
    ageRange.name = `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`
    ageRange.low_value = lowValueNumber
    ageRange.high_value = highValueNumber
    ageRange.low_value_unit = ageRangeUnitValue
    ageRange.high_value_unit = ageRangeUnitValue
    ageRange.organization = Promise.resolve(organization)

    await manager.save(ageRange)
}
