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
