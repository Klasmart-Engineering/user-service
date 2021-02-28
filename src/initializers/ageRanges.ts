import { AgeRange } from '../entities/ageRange'
import { AgeRangeUnit } from '../entities/ageRangeUnit'

export class AgeRangesInitializer {
    NON_SPECIFIED = {
        name: 'Non specified',
        low_value: 0,
        low_value_unit: AgeRangeUnit.YEAR,
        high_value: 99,
        high_value_unit: AgeRangeUnit.YEAR,
        system: true,
    }

    public async run() {
        const ageRange =
            (await AgeRange.findOne({
                low_value: this.NON_SPECIFIED.low_value,
                low_value_unit: this.NON_SPECIFIED.low_value_unit,
                high_value: this.NON_SPECIFIED.high_value,
                high_value_unit: this.NON_SPECIFIED.high_value_unit,
                system: this.NON_SPECIFIED.system,
            })) || new AgeRange()

        ageRange.name = this.NON_SPECIFIED.name
        ageRange.low_value = this.NON_SPECIFIED.low_value
        ageRange.low_value_unit = this.NON_SPECIFIED.low_value_unit
        ageRange.high_value = this.NON_SPECIFIED.high_value
        ageRange.high_value_unit = this.NON_SPECIFIED.high_value_unit
        ageRange.system = this.NON_SPECIFIED.system
        ageRange.organization = undefined

        await ageRange.save()
    }
}

export default new AgeRangesInitializer()
