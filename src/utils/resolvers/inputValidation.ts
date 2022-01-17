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

// BASE FUNCTIONS

/**
 * Checks `ids` against an map.
 *
 * Returns a 'nonExistent'/'duplicate' error for each
 * entity 'not found'/'found' (depending on the value of `checkType`)
 *
 * Also returns the objects which where found on the map.
 */
function checkForNonExistentOrDuplicate<T>(
    checkType: 'nonExistent' | 'duplicate',
    entityName: string
) {
    return (index: number, ids: string[], map: Map<string, T>) => {
        const values: T[] = []
        const errors: APIError[] = []
        for (const id of ids) {
            const entity = map.get(id)
            if (entity) values.push(entity)
            if (
                (!entity && checkType === 'nonExistent') ||
                (entity && checkType === 'duplicate')
            ) {
                errors.push(
                    createEntityAPIError(checkType, index, entityName, id)
                )
            }
        }
        return { values, errors }
    }
}

/**
 * Checks `ids` against a set.
 *
 * Returns a 'nonExistentChild'/'duplicateChild' error for each
 * id 'not found'/'found' (depending on the value of `checkType`)
 */
function checkForNonExistentOrDuplicateChild(
    checkType: 'nonExistentChild' | 'duplicateChild',
    parentEntityName: string,
    childEntityName: string
) {
    return (
        index: number,
        parentId: string,
        childIds: string[],
        childIdsInParentSet: Set<string>
    ) => {
        const errors: APIError[] = []
        for (const childId of childIds) {
            const hasChild = childIdsInParentSet.has(childId)
            if (checkType === 'duplicateChild' ? hasChild : !hasChild) {
                errors.push(
                    createEntityAPIError(
                        checkType,
                        index,
                        childEntityName,
                        childId,
                        parentEntityName,
                        parentId
                    )
                )
            }
        }
        return errors
    }
}

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
function nonExistentSchoolMembership(
    index: number,
    schoolId: string,
    userIds: string[],
    map: SchoolMembershipMap
) {
    const values: SchoolMembership[] = []
    const errors: APIError[] = []
    for (const userId of userIds) {
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
}

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
function nonExistentOrganizationMembership(
    index: number,
    organizationId: string,
    userIds: string[],
    map: OrganizationMembershipMap
) {
    const values: OrganizationMembership[] = []
    const errors: APIError[] = []
    for (const userId of userIds) {
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
}

// INTERMEDIATE FUNCTIONS

const checkForNonExistent = <T>(entityName: string) =>
    checkForNonExistentOrDuplicate<T>('nonExistent', entityName)

const checkForDuplicate = <T>(entityName: string) =>
    checkForNonExistentOrDuplicate<T>('duplicate', entityName)

const checkForNonExistentChild = (
    parentEntityName: string,
    childEntityName: string
) =>
    checkForNonExistentOrDuplicateChild(
        'nonExistentChild',
        parentEntityName,
        childEntityName
    )

const checkForDuplicateChild = (
    parentEntityName: string,
    childEntityName: string
) =>
    checkForNonExistentOrDuplicateChild(
        'duplicateChild',
        parentEntityName,
        childEntityName
    )

// BASE OBJECTS

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
    users: {
        in: {
            school: nonExistentSchoolMembership,
            organization: nonExistentOrganizationMembership,
        },
    },
    programs: { in: { class: checkForNonExistentChild('Class', 'Program') } },
}

const duplicate = {
    user: checkForDuplicate<User>('User'),
    school: checkForDuplicate<School>('School'),
    organization: checkForDuplicate<Organization>('Organization'),
    role: checkForDuplicate<Role>('Role'),
    class: checkForDuplicate<Class>('Class'),
    category: checkForDuplicate<Category>('Category'),
    subcategory: checkForDuplicate<Subcategory>('Subcategory'),
    program: checkForDuplicate<Program>('Program'),
    ageRange: checkForDuplicate<AgeRange>('AgeRange'),
    programs: { in: { class: checkForDuplicateChild('Class', 'Program') } },
}

// INTERFACE OBJECT

/**
 * Returns a function which outputs the objects that where validated
 * and/or their validation errors
 */
export const validate = {
    nonExistent,
    duplicate,
}
