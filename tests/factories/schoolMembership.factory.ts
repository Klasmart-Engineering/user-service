import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { User } from '../../src/entities/user'
import { generateShortCode } from '../../src/utils/shortcode'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { School } from '../../src/entities/school'
import { Role } from '../../src/entities/role'
import { Status } from '../../src/entities/status'

export function createSchoolMembership({
    user,
    school,
    roles,
    status,
}: {
    user: User
    school: School
    roles?: Role[]
    status?: Status
}): SchoolMembership {
    const schoolMembership = new SchoolMembership()
    schoolMembership.school_id = school.school_id
    schoolMembership.school = Promise.resolve(school)
    schoolMembership.user_id = user.user_id
    schoolMembership.user = Promise.resolve(user)
    if (roles) {
        schoolMembership.roles = Promise.resolve(roles)
    }
    if (status) {
        schoolMembership.status = status
    }
    return schoolMembership
}

export const createSchoolMemberships = (
    users: User[],
    school: School,
    roles?: Role[]
) => users.map((user) => createSchoolMembership({ user, school, roles }))

export const createSchoolMembershipsInManySchools = (
    users: User[],
    schools: School[],
    roles?: Role[]
) =>
    schools
        .map((school) => createSchoolMemberships(users, school, roles))
        .flat()
