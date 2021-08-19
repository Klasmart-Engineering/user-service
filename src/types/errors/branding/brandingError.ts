import { CustomError } from '../customError'
import { stringInject } from '../../../utils/stringUtils'

export class BrandingError extends Error {
    constructor(public error: CustomError) {
        super(stringInject(error.message, error.params))
    }
}
