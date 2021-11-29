import { Organization } from '../../src/entities/organization'
import { School } from '../../src/entities/school'
import { User } from '../../src/entities/user'
import { CustomError } from '../../src/types/csv/csvError'
import {
    APIErrorCollection,
    apiErrorConstants,
} from '../../src/types/errors/apiError'
import csvErrorConstants from '../../src/types/errors/csv/csvErrorConstants'

export function buildPermissionError(
    permission: string,
    user: User,
    orgs?: Organization[],
    schools?: School[],
    userDeleted = false
) {
    let message = `User(${user.user_id}) `
    if (userDeleted) message += 'has been deleted, so '
    message += `does not have Permission(${permission})`
    if (orgs) {
        const orgIds = orgs.map((o) => o.organization_id)
        message += ` in Organizations(${orgIds})`
    }
    if (schools) {
        const schoolIds = schools.map((s) => s.school_id)
        message += ` in Schools(${schoolIds})`
    }
    return message
}

/** Mocks the error formatting of the GraphQL query wrapper */
export async function errorFormattingWrapper(res: Promise<any>) {
    try {
        return await res
    } catch (e) {
        if (!('errors' in e)) throw e

        let formattedError = e
        if (e.errors[0].message == csvErrorConstants.ERR_CSV_BAD_INPUT) {
            formattedError = new CustomError(
                e.errors[0]?.extensions?.exception?.errors
            )
        } else if (
            formattedError.errors[0].message ===
            apiErrorConstants.ERR_API_BAD_INPUT
        ) {
            formattedError = new APIErrorCollection(
                e.errors[0]?.extensions?.exception?.errors
            )
        } else if (e instanceof APIErrorCollection) {
            formattedError.errors = e.errors.map((x) => {
                return { ...x }
            })
        } else {
            formattedError = new Error(
                e.errors?.map((x: any) => x.message).join('\n')
            )
        }
        throw formattedError
    }
}
