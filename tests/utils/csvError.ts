import { expect } from 'chai'
import { CSVError } from '../../src/types/csv/csvError'
import { customErrors } from '../../src/types/errors/customError'

export function checkCSVErrorsMatch(error: Error, expectedErrors: CSVError[]) {
    expect(error)
        .to.have.property('message')
        .equal(customErrors.csv_bad_input.message)
    expect(error)
        .to.have.property('errors')
        .to.deep.equalInAnyOrder(expectedErrors)
}
