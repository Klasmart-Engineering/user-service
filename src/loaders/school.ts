import DataLoader from 'dataloader'
import { School } from '../entities/school'
import { Organization } from '../entities/organization'
import { Lazy } from '../utils/lazyLoading'
import { ISchoolsConnectionNode } from '../types/graphQL/schoolsConnectionNode'
import { NodeDataLoader } from './genericNode'

export interface ISchoolLoaders {
    organization: Lazy<DataLoader<string, Organization | undefined>>
    schoolById: Lazy<DataLoader<string, School | undefined>>
}

export interface ISchoolNodeDataLoaders {
    node: Lazy<NodeDataLoader<School, ISchoolsConnectionNode>>
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

export const schoolConnectionNodeFields = ([
    'school_id',
    'school_name',
    'shortcode',
    'status',
    'organizationOrganizationId',
] as (keyof School)[]).map((field) => `School.${field}`)

export function mapSchoolToSchoolConnectionNode(
    school: School
): ISchoolsConnectionNode {
    return {
        id: school.school_id,
        name: school.school_name,
        status: school.status,
        shortCode: school.shortcode,
        organizationId: school.organizationOrganizationId,
    }
}