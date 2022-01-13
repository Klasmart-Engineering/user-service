import { APIError } from '../../types/errors/apiError'
import { User } from '../../entities/user'
import { School } from '../../entities/school'
import { Organization } from '../../entities/organization'
import { SchoolMembership } from '../../entities/schoolMembership'
import { OrganizationMembership } from '../../entities/organizationMembership'
import { createEntityAPIError } from './errors'
import { OrganizationMembershipMap, SchoolMembershipMap } from './entityMaps'
import { Role } from '../../entities/role'
import { Class } from '../../entities/class'
import { Category } from '../../entities/category'
import { Subcategory } from '../../entities/subcategory'
import { Program } from '../../entities/program'
import { AgeRange } from '../../entities/ageRange'

const nonExistent = {
    user: checkForNonExistent<User>('User'),
    school: checkForNonExistent<School>('School'),
    organization: checkForNonExistent<Organization>('Organization'),
    role: checkForNonExistent<Role>('Role'),
    class: checkForNonExistent<Class>('Class'),
    category: checkForNonExistent<Category>('Category'),
    subcategory: checkForNonExistent<Subcategory>('Subcategory'),
    program: checkForNonExistent<Program>('Program'),
    ageRange: checkForNonExistent<AgeRange>('AgeRange'),
}

/**
 * Checks `ids` against an map.
 *
 * Returns a `nonExistent` error for each which does not match a
 * key of the map.
 *
 * Also returns the objects which where found on the map.
 */
function checkForNonExistent<T>(entityTypeName: string) {
    return (index: number, ids: string[], map: Map<string, T>) => {
        const values: T[] = []
        const errors: APIError[] = []
        for (const id of ids) {
            const entity = map.get(id)
            if (entity) values.push(entity)
            else {
                errors.push(
                    createEntityAPIError(
                        'nonExistent',
                        index,
                        entityTypeName,
                        id
                    )
                )
            }
        }
        return { values, errors }
    }
}

const nonExistentChild = {
    /**
     * Checks composite id `{schoolId, userId}` of a
     * `SchoolMembership` against a map. Can check the
     * memberships of a list of users for a school.
     *
     * Returns a `nonExistentChild` error for each user which does
     * not have a membership on the school.
     *
     * Also returns the `SchoolMembership` entities that where found
     * on the map.
     */
    school: (
        index: number,
        school: School,
        users: User[],
        map: SchoolMembershipMap
    ) => {
        const schoolId = school.school_id
        const values: SchoolMembership[] = []
        const errors: APIError[] = []
        for (const user of users) {
            const userId = user.user_id
            const membership = map.get({ schoolId, userId })
            if (membership) values.push(membership)
            else {
                errors.push(
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'User',
                        userId,
                        'School',
                        schoolId
                    )
                )
            }
        }
        return { values, errors }
    },
    /**
     * Checks composite id `{organization, userId}` of a
     * `OrganizationMembership` against a map. Can check the
     * memberships of a list of users for a organizations.
     *
     * Returns a `nonExistentChild` error for each user which does
     * not have a membership on the organization.
     *
     * Also returns the `OrganizationMembership` entities that
     * where found on the map.
     */
    organization: (
        index: number,
        organization: Organization,
        users: User[],
        map: OrganizationMembershipMap
    ) => {
        const organizationId = organization.organization_id
        const values: OrganizationMembership[] = []
        const errors: APIError[] = []
        for (const user of users) {
            const userId = user.user_id
            const membership = map.get({ organizationId, userId })
            if (membership) values.push(membership)
            else {
                errors.push(
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'User',
                        userId,
                        'Organization',
                        organizationId
                    )
                )
            }
        }
        return { values, errors }
    },
}

/**
 * Returns a function which outputs the objects that where validated
 * and/or their validation errors
 */
export const validate = {
    nonExistent,
    nonExistentChild,
}
