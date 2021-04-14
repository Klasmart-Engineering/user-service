import { EntityManager } from 'typeorm'
import { AgeRange } from '../../entities/ageRange'
import { AgeRangeUnit } from '../../entities/ageRangeUnit'
import { Organization } from '../../entities/organization'
import { AgeRangeRow } from '../../types/csv/ageRangeRow'

export async function processAgeRangeFromCSVRow(
    manager: EntityManager,
    row: AgeRangeRow,
    rowNumber: number
) {
    let highValueNumber: number
    let lowValueNumber: number
    let ageRangeUnitValue: AgeRangeUnit
    let organization: Organization | undefined
    let ageRange: AgeRange | undefined

    const {
        organization_name,
        age_range_low_value,
        age_range_high_value,
        age_range_unit,
    } = row

    try {
        if (!organization_name) {
            throw new Error('Organization name is not provided')
        }

        if (!age_range_low_value) {
            throw new Error('Age range low value is not provided')
        }

        if (!age_range_high_value) {
            throw new Error('Age range high value is not provided')
        }

        if (!age_range_unit) {
            throw new Error('Age range unit is not provided')
        }

        highValueNumber = Number(age_range_high_value)
        lowValueNumber = Number(age_range_low_value)
        ageRangeUnitValue = age_range_unit as AgeRangeUnit

        if (
            Number.isNaN(lowValueNumber) ||
            !Number.isInteger(lowValueNumber) ||
            lowValueNumber < 0 ||
            lowValueNumber > 99
        ) {
            throw new Error(
                'age_range_low_value should be an integer number greather or equal to 0 and lower than 100'
            )
        }

        if (
            Number.isNaN(highValueNumber) ||
            !Number.isInteger(highValueNumber) ||
            highValueNumber < 1 ||
            highValueNumber > 99
        ) {
            throw new Error(
                'age_range_high_value should be an integer number greather than 0 and lower than 100'
            )
        }

        if (lowValueNumber >= highValueNumber) {
            throw new Error(
                'age_range_high_value should be greather than age_range_low_value'
            )
        }

        if (
            age_range_unit !== AgeRangeUnit.MONTH &&
            age_range_unit !== AgeRangeUnit.YEAR
        ) {
            throw new Error("age_range_unit should be 'month' or 'year'")
        }

        organization = await manager.findOne(Organization, {
            where: { organization_name },
        })

        if (!organization) {
            throw new Error(
                `Provided organization with name '${organization_name}' doesn't exists`
            )
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
            throw new Error(
                'Provided age range already exists in the provided organization'
            )
        }

        ageRange = new AgeRange()
        ageRange.name = `${age_range_low_value} - ${age_range_high_value} ${age_range_unit}(s)`
        ageRange.low_value = lowValueNumber
        ageRange.high_value = highValueNumber
        ageRange.low_value_unit = ageRangeUnitValue
        ageRange.high_value_unit = ageRangeUnitValue
        ageRange.organization = Promise.resolve(organization)

        await manager.save(ageRange)
    } catch (error) {
        throw new Error(`[row ${rowNumber}]. ${error.message}`)
    }
}
