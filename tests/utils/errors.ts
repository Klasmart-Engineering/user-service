import { Organization } from '../../src/entities/organization'
import { School } from '../../src/entities/school'
import { User } from '../../src/entities/user'

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
    if (orgs?.length) {
        const orgIds = orgs.map((o) => o.organization_id)
        message += ` in Organizations(${orgIds})`
    }
    if (schools?.length) {
        const schoolIds = schools.map((s) => s.school_id)
        message += ` in Schools(${schoolIds})`
    }
    return message
}

export const permErrorMeta = (permission: string) => {
    return (usr: User, orgs?: Organization[]): string =>
        buildPermissionError(permission, usr, orgs)
}
