import DataLoader from 'dataloader'
import { Program } from '../entities/program'
import { AgeRangeSummaryNode } from '../types/graphQL/ageRangeSummaryNode'
import { GradeSummaryNode } from '../types/graphQL/gradeSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
import {
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'

export interface IProgramsConnectionLoaders {
    ageRanges?: DataLoader<string, AgeRangeSummaryNode[]>
    grades?: DataLoader<string, GradeSummaryNode[]>
    subjects?: DataLoader<string, SubjectSummaryNode[]>
}

export const ageRangesForPrograms = async (
    programIds: readonly string[],
    filter?: IEntityFilter
): Promise<AgeRangeSummaryNode[][]> => {
    const programAgeRanges: AgeRangeSummaryNode[][] = []
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.organization', 'Organization')
        .leftJoinAndSelect('Program.age_ranges', 'AgeRange')
        .leftJoinAndSelect('Program.grades', 'Grade')
        .leftJoinAndSelect('Program.subjects', 'Subject')
        .where('Program.id IN (:...ids)', { ids: programIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                status: ['Program.status'],
            })
        )
    }

    const programs = await scope.getMany()
    for (const programId of programIds) {
        const currentAgeRanges: AgeRangeSummaryNode[] = []
        const program = programs.find((p) => p.id === programId)

        if (program) {
            const ageRanges = (await program.age_ranges) || []

            for (const ageRange of ageRanges) {
                currentAgeRanges.push({
                    id: ageRange.id,
                    name: ageRange.name,
                    lowValue: ageRange.low_value,
                    highValue: ageRange.high_value,
                    lowValueUnit: ageRange.low_value_unit,
                    highValueUnit: ageRange.high_value_unit,
                    status: ageRange.status,
                    system: !!ageRange.system,
                })
            }
        }

        programAgeRanges.push(currentAgeRanges)
    }

    return programAgeRanges
}

export const gradesForPrograms = async (
    programIds: readonly string[],
    filter?: IEntityFilter
): Promise<GradeSummaryNode[][]> => {
    const programGrades: GradeSummaryNode[][] = []
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.organization', 'Organization')
        .leftJoinAndSelect('Program.age_ranges', 'AgeRange')
        .leftJoinAndSelect('Program.grades', 'Grade')
        .leftJoinAndSelect('Program.subjects', 'Subject')
        .where('Program.id IN (:...ids)', { ids: programIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                status: ['Program.status'],
            })
        )
    }

    const programs = await scope.getMany()
    for (const programId of programIds) {
        const currentGrades: GradeSummaryNode[] = []
        const program = programs.find((p) => p.id === programId)

        if (program) {
            const grades = (await program.grades) || []
            for (const grade of grades) {
                currentGrades.push({
                    id: grade.id,
                    name: grade.name,
                    status: grade.status,
                    system: !!grade.system,
                })
            }
        }

        programGrades.push(currentGrades)
    }

    return programGrades
}

export const subjectsForPrograms = async (
    programIds: readonly string[],
    filter?: IEntityFilter
): Promise<SubjectSummaryNode[][]> => {
    const programSubjects: SubjectSummaryNode[][] = []
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.organization', 'Organization')
        .leftJoinAndSelect('Program.age_ranges', 'AgeRange')
        .leftJoinAndSelect('Program.grades', 'Grade')
        .leftJoinAndSelect('Program.subjects', 'Subject')
        .where('Program.id IN (:...ids)', { ids: programIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                status: ['Program.status'],
            })
        )
    }

    const programs = await scope.getMany()
    for (const programId of programIds) {
        const currentSubjects: SubjectSummaryNode[] = []
        const program = programs.find((p) => p.id === programId)

        if (program) {
            const subjects = (await program.subjects) || []
            for (const subject of subjects) {
                currentSubjects.push({
                    id: subject.id,
                    name: subject.name,
                    status: subject.status,
                    system: !!subject.system,
                })
            }
        }

        programSubjects.push(currentSubjects)
    }

    return programSubjects
}
