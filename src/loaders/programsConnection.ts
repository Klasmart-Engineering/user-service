import DataLoader from 'dataloader'
import { Program } from '../entities/program'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRangeConnectionNode'
import { GradeSummaryNode } from '../types/graphQL/gradeSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'

export interface IProgramsConnectionLoaders {
    ageRanges?: DataLoader<string, AgeRangeConnectionNode[]>
    grades?: DataLoader<string, GradeSummaryNode[]>
    subjects?: DataLoader<string, SubjectSummaryNode[]>
}

export const ageRangesForPrograms = async (
    programIds: readonly string[],
    filter?: IEntityFilter
): Promise<AgeRangeConnectionNode[][]> => {
    const programAgeRanges: AgeRangeConnectionNode[][] = []
    const scope = await Program.createQueryBuilder('Program')

    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('Program.organization', 'Organization')
        }

        if (filterHasProperty('gradeId', filter)) {
            scope.leftJoinAndSelect('Program.grades', 'Grade')
        }

        if (
            filterHasProperty('ageRangeFrom', filter) ||
            filterHasProperty('ageRangeTo', filter) ||
            filterHasProperty('ageRangeUnitFrom', filter) ||
            filterHasProperty('ageRangeValueFrom', filter) ||
            filterHasProperty('ageRangeUnitTo', filter) ||
            filterHasProperty('ageRangeValueTo', filter)
        ) {
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
        }

        if (filterHasProperty('subjectId', filter)) {
            scope.leftJoinAndSelect('Program.subjects', 'Subject')
        }

        if (filterHasProperty('schoolId', filter)) {
            scope.leftJoinAndSelect('Program.schools', 'School')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Program.id',
                name: 'Program.name',
                system: 'Program.system',
                status: 'Program.status',
                organizationId: 'Organization.organization_id',
                gradeId: 'Grade.id',
                ageRangeFrom: '',
                ageRangeTo: '',
                ageRangeUnitFrom: '',
                ageRangeValueFrom: '',
                ageRangeUnitTo: '',
                ageRangeValueTo: '',
                subjectId: 'Subject.id',
                schoolId: 'School.school_id',
            })
        )
    }

    scope.where('Program.id IN (:...ids)', { ids: programIds })

    const programs = await scope.getMany()

    for (const programId of programIds) {
        const program = programs.find((p) => p.id === programId)

        if (program) {
            const currentAgeRanges: AgeRangeConnectionNode[] = []
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

            programAgeRanges.push(currentAgeRanges)
        } else {
            programAgeRanges.push([])
        }
    }

    return programAgeRanges
}

export const gradesForPrograms = async (
    programIds: readonly string[],
    filter?: IEntityFilter
): Promise<GradeSummaryNode[][]> => {
    const programGrades: GradeSummaryNode[][] = []
    const scope = await Program.createQueryBuilder('Program')

    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('Program.organization', 'Organization')
        }

        if (filterHasProperty('gradeId', filter)) {
            scope.leftJoinAndSelect('Program.grades', 'Grade')
        }

        if (
            filterHasProperty('ageRangeFrom', filter) ||
            filterHasProperty('ageRangeTo', filter) ||
            filterHasProperty('ageRangeUnitFrom', filter) ||
            filterHasProperty('ageRangeValueFrom', filter) ||
            filterHasProperty('ageRangeUnitTo', filter) ||
            filterHasProperty('ageRangeValueTo', filter)
        ) {
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
        }

        if (filterHasProperty('subjectId', filter)) {
            scope.leftJoinAndSelect('Program.subjects', 'Subject')
        }

        if (filterHasProperty('schoolId', filter)) {
            scope.leftJoinAndSelect('Program.schools', 'School')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Program.id',
                name: 'Program.name',
                system: 'Program.system',
                status: 'Program.status',
                organizationId: 'Organization.organization_id',
                gradeId: '',
                ageRangeFrom: {
                    operator: 'AND',
                    aliases: ['AgeRange.low_value', 'AgeRange.low_value_unit'],
                },
                ageRangeTo: {
                    operator: 'AND',
                    aliases: [
                        'AgeRange.high_value',
                        'AgeRange.high_value_unit',
                    ],
                },
                ageRangeUnitFrom: 'AgeRange.low_value_unit',
                ageRangeValueFrom: 'AgeRange.low_value',
                ageRangeUnitTo: 'AgeRange.high_value_unit',
                ageRangeValueTo: 'AgeRange.high_value',
                subjectId: 'Subject.id',
                schoolId: 'School.school_id',
            })
        )
    }

    scope.where('Program.id IN (:...ids)', { ids: programIds })

    const programs = await scope.getMany()
    for (const programId of programIds) {
        const program = programs.find((p) => p.id === programId)

        if (program) {
            const currentGrades: GradeSummaryNode[] = []
            const grades = (await program.grades) || []
            for (const grade of grades) {
                currentGrades.push({
                    id: grade.id,
                    name: grade.name,
                    status: grade.status,
                    system: !!grade.system,
                })
            }

            programGrades.push(currentGrades)
        } else {
            programGrades.push([])
        }
    }

    return programGrades
}

export const subjectsForPrograms = async (
    programIds: readonly string[],
    filter?: IEntityFilter
): Promise<SubjectSummaryNode[][]> => {
    const programSubjects: SubjectSummaryNode[][] = []
    const scope = await Program.createQueryBuilder('Program')

    if (filter) {
        if (filterHasProperty('organizationId', filter)) {
            scope.leftJoinAndSelect('Program.organization', 'Organization')
        }

        if (filterHasProperty('gradeId', filter)) {
            scope.leftJoinAndSelect('Program.grades', 'Grade')
        }

        if (
            filterHasProperty('ageRangeFrom', filter) ||
            filterHasProperty('ageRangeTo', filter) ||
            filterHasProperty('ageRangeUnitFrom', filter) ||
            filterHasProperty('ageRangeValueFrom', filter) ||
            filterHasProperty('ageRangeUnitTo', filter) ||
            filterHasProperty('ageRangeValueTo', filter)
        ) {
            scope.leftJoinAndSelect('Program.age_ranges', 'AgeRange')
        }

        if (filterHasProperty('subjectId', filter)) {
            scope.leftJoinAndSelect('Program.subjects', 'Subject')
        }

        if (filterHasProperty('schoolId', filter)) {
            scope.leftJoinAndSelect('Program.schools', 'School')
        }

        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                id: 'Program.id',
                name: 'Program.name',
                system: 'Program.system',
                status: 'Program.status',
                organizationId: 'Organization.organization_id',
                gradeId: 'Grade.id',
                ageRangeFrom: {
                    operator: 'AND',
                    aliases: ['AgeRange.low_value', 'AgeRange.low_value_unit'],
                },
                ageRangeTo: {
                    operator: 'AND',
                    aliases: [
                        'AgeRange.high_value',
                        'AgeRange.high_value_unit',
                    ],
                },
                ageRangeUnitFrom: 'AgeRange.low_value_unit',
                ageRangeValueFrom: 'AgeRange.low_value',
                ageRangeUnitTo: 'AgeRange.high_value_unit',
                ageRangeValueTo: 'AgeRange.high_value',
                subjectId: '',
                schoolId: 'School.school_id',
            })
        )
    }

    scope.where('Program.id IN (:...ids)', { ids: programIds })

    const programs = await scope.getMany()
    for (const programId of programIds) {
        const program = programs.find((p) => p.id === programId)

        if (program) {
            const currentSubjects: SubjectSummaryNode[] = []
            const subjects = (await program.subjects) || []
            for (const subject of subjects) {
                currentSubjects.push({
                    id: subject.id,
                    name: subject.name,
                    status: subject.status,
                    system: !!subject.system,
                })
            }

            programSubjects.push(currentSubjects)
        } else {
            programSubjects.push([])
        }
    }

    return programSubjects
}
