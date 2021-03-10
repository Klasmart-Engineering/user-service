import { getManager } from 'typeorm'
import { AgeRange } from '../entities/ageRange'
import { AgeRangeUnit } from '../entities/ageRangeUnit'

export class AgeRangesInitializer {
    SYSTEM_AGE_RANGES = [
        {
            id: '023eeeb1-5f72-4fa3-a2a7-63603607ac2b',
            name: 'Non specified',
            low_value: 0,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 99,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: '7965d220-619d-400f-8cab-42bd98c7d23c',
            name: '3 - 4 year(s)',
            low_value: 3,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 4,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: 'bb7982cd-020f-4e1a-93fc-4a6874917f07',
            name: '4 - 5 year(s)',
            low_value: 4,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 5,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: 'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
            name: '5 - 6 year(s)',
            low_value: 5,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 6,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: '145edddc-2019-43d9-97e1-c5830e7ed689',
            name: '6 - 7 year(s)',
            low_value: 6,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 7,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            name: '7 - 8 year(s)',
            low_value: 7,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 8,
            high_value_unit: AgeRangeUnit.YEAR,
        },
    ]

    public async run() {
        // Delete all records to update uuids. This will go away after first run
        const oldSystemRanges = await AgeRange.find({ where: { system: true } })
        await getManager().remove(oldSystemRanges)

        for (const systemAgeRange of this.SYSTEM_AGE_RANGES) {
            const ageRange =
                (await AgeRange.findOne({ id: systemAgeRange.id })) ||
                new AgeRange()

            ageRange.id = systemAgeRange.id
            ageRange.name = systemAgeRange.name
            ageRange.low_value = systemAgeRange.low_value
            ageRange.low_value_unit = systemAgeRange.low_value_unit
            ageRange.high_value = systemAgeRange.high_value
            ageRange.high_value_unit = systemAgeRange.high_value_unit
            ageRange.system = true
            ageRange.organization = undefined

            await ageRange.save()
        }
    }
}

export default new AgeRangesInitializer()
