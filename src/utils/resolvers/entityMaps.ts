import { CustomBaseEntity } from '../../entities/customBaseEntity'
import { SchoolMembership } from '../../entities/schoolMembership'
import { OrganizationMembership } from '../../entities/organizationMembership'
import { Status } from '../../entities/status'
import { In } from 'typeorm'
import { User } from '../../entities/user'
import { School } from '../../entities/school'
import { Organization } from '../../entities/organization'
import { Role } from '../../entities/role'
import { Class } from '../../entities/class'
import { Category } from '../../entities/category'
import { Subcategory } from '../../entities/subcategory'
import { Program } from '../../entities/program'
import { AgeRange } from '../../entities/ageRange'
import { ObjMap } from '../stringUtils'
import { Subject } from '../../entities/subject'
import { Grade } from '../../entities/grade'

export type ConflictingNameKey = {
    organizationId?: string
    name: string
}

/**
 * Queries the db for a list of entities by ID, then converts that into a map (ID => Entity)
 */
function idToEntityMap<T extends CustomBaseEntity>(
    entity: typeof CustomBaseEntity
): (ids: string[], relations?: string[]) => Promise<Map<string, T>> {
    return async (
        ids: string[],
        relations?: string[]
    ): Promise<Map<string, T>> => {
        return entity
            .findByIds(ids, {
                where: { status: Status.ACTIVE },
                relations,
            })
            .then((entities) => {
                return entities.reduce(
                    (map: Map<string, T>, e) =>
                        map.set(entity.getId(e), e as T),
                    new Map()
                )
            })
    }
}

export type SchoolMembershipMap = ObjMap<
    { schoolId: string; userId: string },
    SchoolMembership
>
export type OrganizationMembershipMap = ObjMap<
    { organizationId: string; userId: string },
    OrganizationMembership
>

/**
 * Queries the db for a list of membership entities by ID,
 * then converts that into a map (ID => Entity) using ObjMap to handle
 * the composite ID of OrganizationMembership & SchoolMembership
 */
const membership = {
    organization: async (
        organizationIds: string[],
        userIds: string[],
        relations?: string[]
    ): Promise<OrganizationMembershipMap> => {
        return OrganizationMembership.find({
            where: {
                user_id: In(userIds),
                organization_id: In(organizationIds),
                status: Status.ACTIVE,
            },
            relations,
        }).then((entities) => {
            return new ObjMap(
                entities.map((e) => {
                    return {
                        key: {
                            organizationId: e.organization_id,
                            userId: e.user_id,
                        },
                        value: e,
                    }
                })
            )
        })
    },
    school: async (
        schoolIds: string[],
        userIds: string[],
        relations?: string[]
    ): Promise<SchoolMembershipMap> => {
        return SchoolMembership.find({
            where: {
                user_id: In(userIds),
                school_id: In(schoolIds),
                status: Status.ACTIVE,
            },
            relations,
        }).then((entities) => {
            return new ObjMap(
                entities.map((e) => {
                    return {
                        key: { schoolId: e.school_id, userId: e.user_id },
                        value: e,
                    }
                })
            )
        })
    },
}

/**
 * Returns a function which can be used to kick off a database query for a
 * list of entities, which will be returned in the form of a map
 */
export const getMap = {
    user: idToEntityMap<User>(User),
    school: idToEntityMap<School>(School),
    organization: idToEntityMap<Organization>(Organization),
    role: idToEntityMap<Role>(Role),
    class: idToEntityMap<Class>(Class),
    category: idToEntityMap<Category>(Category),
    subcategory: idToEntityMap<Subcategory>(Subcategory),
    program: idToEntityMap<Program>(Program),
    ageRange: idToEntityMap<AgeRange>(AgeRange),
    subject: idToEntityMap<Subject>(Subject),
    grade: idToEntityMap<Grade>(Grade),
    membership,
}
