import DataLoader from 'dataloader'
import { School } from '../entities/school'
import { Organization } from '../entities/organization'

export interface ISchoolLoaders {
    organization: DataLoader<string, Organization | undefined>
    schoolById: DataLoader<string, School | undefined>
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
