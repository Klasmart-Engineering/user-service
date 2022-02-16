import { FileUpload } from 'graphql-upload'
import logger from '../logging'
import fs from 'fs'

export function extensionForFile(file: FileUpload): string | undefined {
    const mimetype = file.mimetype

    let fileExt: string | undefined

    const matchRes = mimetype.match(/[^/]+$/)
    if (matchRes) {
        fileExt = matchRes[0]
    }
    return fileExt
}

// If the src code has been instrumented with istanbul
// then the results will be stored in global.__coverage__
// see https://stackoverflow.com/a/59626976
// and https://github.com/kirksl/karate-istanbul/blob/e5eecd7596b5c2087a07cd61aff6b2025d6c850d/test/test.js#L21
export function saveCodeCoverage() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coverageResults = (<any>global).__coverage__
    if (coverageResults !== undefined) {
        if (process.env.NODE_ENV === 'development') {
            logger.info('code coverage information found, saving')
        } else {
            logger.warn(
                `code coverage results found with NODE_ENV of ${process.env.NODE_ENV}`
            )
        }
        fs.writeFileSync(
            './.nyc_output/container_coverage.json',
            JSON.stringify(coverageResults),
            {
                encoding: 'utf8',
            }
        )
    }
}
