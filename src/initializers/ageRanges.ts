import { AgeRange } from '../entities/ageRange'
import { AgeRangeUnit } from '../entities/ageRangeUnit'
import { Status } from '../entities/status'

export class AgeRangesInitializer {
    SYSTEM_AGE_RANGES = [
        {
            id: '023eeeb1-5f72-4fa3-a2a7-63603607ac2b',
            name: 'None Specified',
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
        {
            id: '04e5b813-7eaf-44f9-8c37-171315e8b296',
            name: '10 - 11 year(s)',
            low_value: 10,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 11,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: '4cdccdc2-a928-44d4-8298-d63196c86dd1',
            name: '11 - 12 year(s)',
            low_value: 11,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 12,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: '7cf0d4b8-e26e-4580-93fb-a1fdad39b4df',
            name: '12 - 13 year(s)',
            low_value: 12,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 13,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: 'd493188f-5503-4820-beef-6c6583657ab3',
            name: '13 - 14 year(s)',
            low_value: 13,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 14,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: 'e07cacc3-718d-4c19-948e-57bba80906ee',
            name: '14 - 15 year(s)',
            low_value: 14,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 15,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: 'f58759cd-f65e-4deb-87f1-d972baf38106',
            name: '15 - 16 year(s)',
            low_value: 15,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 16,
            high_value_unit: AgeRangeUnit.YEAR,
        },
        {
            id: '175353f5-773a-48bc-9319-c1aa439ad02b',
            name: '16 - 17 year(s)',
            low_value: 16,
            low_value_unit: AgeRangeUnit.YEAR,
            high_value: 17,
            high_value_unit: AgeRangeUnit.YEAR,
        },
    ]

    public async run() {
        for (const systemAgeRange of this.SYSTEM_AGE_RANGES) {
            const ageRangeAttributes = {
                id: systemAgeRange.id,
                name: systemAgeRange.name,
                low_value: systemAgeRange.low_value,
                low_value_unit: systemAgeRange.low_value_unit,
                high_value: systemAgeRange.high_value,
                high_value_unit: systemAgeRange.high_value_unit,
                system: true,
                organization_id: undefined,
                status: Status.ACTIVE,
            }

            // eslint-disable-next-line no-await-in-loop
            await AgeRange.createQueryBuilder()
                .insert()
                .into(AgeRange)
                .values(ageRangeAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: [
                        'name',
                        'low_value',
                        'low_value_unit',
                        'high_value',
                        'high_value_unit',
                        'system',
                        'organization_id',
                        'status',
                    ],
                })
                .execute()
        }
    }
}

export default new AgeRangesInitializer()
