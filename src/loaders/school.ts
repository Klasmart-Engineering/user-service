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
    const orgs: (Organization | undefined)[] = []

    const scope = School.createQueryBuilder()
        .leftJoinAndSelect('School.organization', 'Organization')
        .where('school_id IN (:...ids)', {
            ids: schoolIds,
        })

    const data = await scope.getMany()

    for (const schoolId of schoolIds) {
        const school = data.find((s) => s.school_id === schoolId)
        const org = await school?.organization
        orgs.push(org)
    }

    return orgs
}

export const schoolsByIds = async (
    schoolIds: readonly string[]
): Promise<(School | undefined)[]> => {
    const data = await School.findByIds(schoolIds as string[])
    const map = new Map(data.map((school) => [school.school_id, school]))
    return schoolIds.map((id) => map.get(id))
}
