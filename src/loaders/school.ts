import DataLoader from 'dataloader'
import { School } from '../entities/school'
import { Organization } from '../entities/organization'
import { Lazy } from '../utils/lazyLoading'
import { buildStaticAPIErrorProps } from './genericNode'
import { ISchoolsConnectionNode } from '../types/graphQL/school'
import { SelectQueryBuilder } from 'typeorm'
import { APIError } from '../types/errors/apiError'
import {
    schoolConnectionNodeFields,
    mapSchoolToSchoolConnectionNode,
} from '../pagination/schoolsConnection'

export interface ISchoolLoaders {
    organization: Lazy<DataLoader<string, Organization | undefined>>
    schoolById: Lazy<DataLoader<string, School | undefined>>
}

export const organizationsForSchools = async (
    schoolIds: readonly string[]
): Promise<(Organization | undefined)[]> => {
    const scope = School.createQueryBuilder()
        .leftJoinAndSelect('School.organization', 'Organization')
        .where('school_id IN (:...ids)', {
            ids: schoolIds,
        })

    const schools = new Map(
        (await scope.getMany()).map((school) => [school.school_id, school])
    )

    return Promise.all(
        schoolIds.map(async (schoolId) => {
            return schools.get(schoolId)?.organization
        })
    )
}

export const schoolsByIds = async (
    schoolIds: readonly string[]
): Promise<(School | undefined)[]> => {
    const schools = new Map(
        (await School.findByIds(schoolIds as string[])).map((school) => [
            school.school_id,
            school,
        ])
    )
    return schoolIds.map((id) => schools.get(id))
}

/**
 * The schoolConnectionNode requires a join between School and Organization.
 * The mapSchoolToSchoolConnectionNode returns a Promise. These two changes
 * required too much changes and use of Unions in the generic NodeDataLoader
 * to be able to use it only for this case. All the rest of the single node
 * queries were already implemented well with the Generic one. That's why it
 * was added a custom one for School.
 */
export class SchoolNodeDataLoader extends DataLoader<
    { id: string; scope: SelectQueryBuilder<School> },
    ISchoolsConnectionNode | APIError
> {
    constructor() {
        super(async function (
            keys: readonly { id: string; scope: SelectQueryBuilder<School> }[]
        ): Promise<(ISchoolsConnectionNode | APIError)[]> {
            const ids = []
            const scope = keys[0].scope
            for (const key of keys) {
                ids.push(key.id)
            }
            scope
                .select(schoolConnectionNodeFields)
                .andWhere(`"School"."school_id" IN (:...ids)`, {
                    ids,
                })
                .innerJoin('School.organization', 'Organization')
            console.log(scope)
            const entities = await scope.getMany()
            const nodes: ISchoolsConnectionNode[] = []
            for (const entity of entities) {
                nodes.push(await mapSchoolToSchoolConnectionNode(entity))
            }

            const nodesMap = new Map<string, ISchoolsConnectionNode>(
                nodes.map((node) => [node.id, node])
            )

            const staticErrorProps = buildStaticAPIErrorProps(
                'SchoolConnectionNode'
            )

            return ids.map(
                (id) =>
                    nodesMap.get(id) ??
                    new APIError({
                        ...staticErrorProps,
                        entityName: id,
                    })
            )
        })
    }
}
