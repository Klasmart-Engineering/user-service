import DataLoader from 'dataloader'
import { Program } from '../entities/program'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRangeConnectionNode'
import { GradeSummaryNode } from '../types/graphQL/gradeSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'

export interface IProgramsConnectionLoaders {
    ageRanges?: DataLoader<string, AgeRangeConnectionNode[]>
    grades?: DataLoader<string, GradeSummaryNode[]>
    subjects?: DataLoader<string, SubjectSummaryNode[]>
}

export const ageRangesForPrograms = async (
    programIds: readonly string[]
): Promise<AgeRangeConnectionNode[][]> => {
    const programAgeRanges: AgeRangeConnectionNode[][] = []
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.age_ranges', 'AgeRanges')
        .where('Program.id IN (:...ids)', { ids: programIds })

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
    programIds: readonly string[]
): Promise<GradeSummaryNode[][]> => {
    const programGrades: GradeSummaryNode[][] = []
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.grades', 'Grades')
        .where('Program.id IN (:...ids)', { ids: programIds })

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
    programIds: readonly string[]
): Promise<SubjectSummaryNode[][]> => {
    const programSubjects: SubjectSummaryNode[][] = []
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.subjects', 'Subjects')
        .where('Program.id IN (:...ids)', { ids: programIds })

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
