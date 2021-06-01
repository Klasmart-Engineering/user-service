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
    const scope = await Program.createQueryBuilder('program')
        .leftJoinAndSelect('program.age_ranges', 'age_ranges')
        .leftJoinAndSelect('program.grades', 'grades')
        .leftJoinAndSelect('program.subjects', 'subjects')
        .where('program.id IN (:...ids)', { ids: programIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                ageRangeId: ['AgeRange.id'],
                gradeId: ['Grade.id'],
                subjectId: ['Subject.id'],
                programId: ['id'],
                name: ['name'],
                status: ['program.status'],
            })
        )
    }

    const programs = await scope.getMany()

    for (const program of programs) {
        const currentAgeRanges: AgeRangeSummaryNode[] = []
        const ageRanges = (await program.age_ranges) || []

        for (const ageRange of ageRanges) {
            currentAgeRanges.push({
                id: ageRange.id,
                name: ageRange.name,
                status: ageRange.status,
            })
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
    const scope = await Program.createQueryBuilder('program')
        .leftJoinAndSelect('program.age_ranges', 'age_ranges')
        .leftJoinAndSelect('program.grades', 'grades')
        .leftJoinAndSelect('program.subjects', 'subjects')
        .where('program.id IN (:...ids)', { ids: programIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                ageRangeId: ['AgeRange.id'],
                gradeId: ['Grade.id'],
                subjectId: ['Subject.id'],
                programId: ['id'],
                name: ['name'],
                status: ['program.status'],
            })
        )
    }

    const programs = await scope.getMany()

    for (const program of programs) {
        const currentGrades: GradeSummaryNode[] = []
        const grades = (await program.grades) || []

        for (const grade of grades) {
            currentGrades.push({
                id: grade.id,
                name: grade.name,
                status: grade.status,
            })
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
    const scope = await Program.createQueryBuilder('program')
        .leftJoinAndSelect('program.age_ranges', 'age_ranges')
        .leftJoinAndSelect('program.grades', 'grades')
        .leftJoinAndSelect('program.subjects', 'subjects')
        .where('program.id IN (:...ids)', { ids: programIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                ageRangeId: ['AgeRange.id'],
                gradeId: ['Grade.id'],
                subjectId: ['Subject.id'],
                programId: ['id'],
                name: ['name'],
                status: ['program.status'],
            })
        )
    }

    const programs = await scope.getMany()

    for (const program of programs) {
        const currentSubjects: SubjectSummaryNode[] = []
        const subjects = (await program.subjects) || []

        for (const subject of subjects) {
            currentSubjects.push({
                id: subject.id,
                name: subject.name,
                status: subject.status,
            })
        }

        programSubjects.push(currentSubjects)
    }

    return programSubjects
}
