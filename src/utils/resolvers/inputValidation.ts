import { APIError } from '../../types/errors/apiError'
import { User } from '../../entities/user'
import { School } from '../../entities/school'
import { Organization } from '../../entities/organization'
import { OrganizationMembership } from '../../entities/organizationMembership'
import { createEntityAPIError } from './errors'
import { OrganizationMembershipMap, SchoolMembershipMap } from './entityMaps'
import { Role } from '../../entities/role'
import { Class } from '../../entities/class'
import { Category } from '../../entities/category'
import { Subcategory } from '../../entities/subcategory'
import { Program } from '../../entities/program'
import { AgeRange } from '../../entities/ageRange'
import { Subject } from '../../entities/subject'
import { SchoolMembership } from '../../entities/schoolMembership'
import { Grade } from '../../entities/grade'
import { AcademicTerm } from '../../entities/academicTerm'

export type Entities =
    | User
    | School
    | Organization
    | Role
    | Class
    | Category
    | Subcategory
    | Program
    | AgeRange
    | Subject
    | Grade
    | AcademicTerm

export type SystemEntities =
    | AgeRange
    | Grade
    | Subject
    | Program
    | Category
    | Subcategory

export type SystemEntityAndOrg = SystemEntities & {
    __organization__?: Organization
}

/**
 * Checks if a determined sub item exists for an organization or is system
 */
export function validateSubItemsInOrg<T extends SystemEntityAndOrg>(
    subItemClass: new () => T,
    subItemIds: string[],
    index: number,
    map: Map<string, T>,
    organizationId?: string
) {
    return subItemIds
        .filter((id) => {
            const subItem = map.get(id)

            if (subItem) {
                let isInOrg = true
                const isSystem = subItem.system

                if (organizationId) {
                    isInOrg =
                        subItem.__organization__?.organization_id ===
                        organizationId
                }

                return !isSystem && !isInOrg
            }
        })
        .map((id) =>
            createEntityAPIError(
                'nonExistentChild',
                index,
                subItemClass.name,
                id,
                'Organization',
                organizationId
            )
        )
}

/**
 * Checks `ids` against an map and flags an existent/non_existent error.
 */
function flagExistentOrNonExistent(checkType: 'nonExistent' | 'existent') {
    return <T extends Entities>(
        entityClass: new () => T,
        index: number,
        ids: string[],
        map: Map<string, T>
    ) => {
        const values: T[] = []
        const errors: APIError[] = []
        for (const id of ids) {
            const entity = map.get(id)
            if (checkType === 'nonExistent' && entity) values.push(entity)
            if (checkType === 'existent' ? entity : !entity) {
                errors.push(
                    createEntityAPIError(checkType, index, entityClass.name, id)
                )
            }
        }
        return { values, errors }
    }
}

/**
 * Checks `ids` against a set and flags an child existent/non_existent error.
 */
function flagExistentOrNonExistentChild(
    checkType: 'nonExistentChild' | 'existentChild'
) {
    return <T extends Entities, U extends Entities>(
        parentClass: new () => T,
        childClass: new () => U,
        index: number,
        parentId: string,
        childIds: string[],
        childIdsInParentSet: Set<string>
    ) => {
        const errors: APIError[] = []
        for (const childId of childIds) {
            const hasChild = childIdsInParentSet.has(childId)
            if (checkType === 'existentChild' ? hasChild : !hasChild) {
                errors.push(
                    createEntityAPIError(
                        checkType,
                        index,
                        childClass.name,
                        childId,
                        parentClass.name,
                        parentId
                    )
                )
            }
        }
        return errors
    }
}

/**
 * Checks if each user has a membership with the given organization.
 */
function flagExistentOrNonExistentOrganizationMembership(
    checkType: 'nonExistentChild' | 'existentChild'
) {
    return (
        index: number,
        organizationId: string,
        userIds: string[],
        map: OrganizationMembershipMap
    ) => {
        const values: OrganizationMembership[] = []
        const errors: APIError[] = []
        for (const userId of userIds) {
            const membership = map.get({ organizationId, userId })
            if (checkType === 'nonExistentChild' && membership) {
                values.push(membership)
            }
            if (checkType === 'existentChild' ? membership : !membership) {
                errors.push(
                    createEntityAPIError(
                        checkType,
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
}

/**
 * Checks if each user has a membership with the given school.
 */
function flagExistentOrNonExistentSchoolMembership(
    checkType: 'nonExistentChild' | 'existentChild'
) {
    return (
        index: number,
        schoolId: string,
        userIds: string[],
        map: SchoolMembershipMap
    ) => {
        const values: SchoolMembership[] = []
        const errors: APIError[] = []
        for (const userId of userIds) {
            const membership = map.get({ schoolId, userId })
            if (checkType === 'nonExistentChild' && membership) {
                values.push(membership)
            }
            if (checkType === 'existentChild' ? membership : !membership) {
                errors.push(
                    createEntityAPIError(
                        checkType,
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
}

/**
 * Checks if each user has a membership with the given school.
 *
 * Returns a `nonExistentChild` error for each if the membership is not found
 * on the map.
 *
 * Also returns the `SchoolMembership` entities that where found
 * on the map.
 */
export const flagNonExistentSchoolMembership = flagExistentOrNonExistentSchoolMembership(
    'nonExistentChild'
)

/**
 * Checks if each user has a membership with the given school.
 *
 * Returns a `existentChild` error for each if the membership is found
 * on the map.
 */
export const flagExistentSchoolMembership = flagExistentOrNonExistentSchoolMembership(
    'existentChild'
)

/**
 * Checks if each user has a membership with the given organization.
 *
 * Returns a `nonExistentChild` error for each if the membership is not found
 * on the map.
 *
 * Also returns the `OrganizationMembership` entities that
 * where found on the map.
 */
export const flagNonExistentOrganizationMembership = flagExistentOrNonExistentOrganizationMembership(
    'nonExistentChild'
)

/**
 * Checks if each user has a membership with the given organization.
 *
 * Returns a `nonExistentChild` error for each if the membership is found
 * on the map.
 */
export const flagExistentOrganizationMembership = flagExistentOrNonExistentOrganizationMembership(
    'existentChild'
)

/**
 * Checks `ids` against an map.
 *
 * Returns a 'nonExistent' error for each if not found on the map.
 *
 * Also returns the objects which where found on the map.
 */
export const flagNonExistent = flagExistentOrNonExistent('nonExistent')

/**
 * Checks `ids` against an map.
 *
 * Returns an 'existent' error for each if found on the map.
 */
export const flagExistent = flagExistentOrNonExistent('existent')

/**
 * Checks `ids` against a set.
 *
 * Returns a 'nonExistentChild' error for each if not found on the set.
 */
export const flagNonExistentChild = flagExistentOrNonExistentChild(
    'nonExistentChild'
)

/**
 * Checks `ids` against a set.
 *
 * Returns an 'existentChild' error for each if found on the set.
 */
export const flagExistentChild = flagExistentOrNonExistentChild('existentChild')
