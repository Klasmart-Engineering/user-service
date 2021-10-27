import DataLoader from 'dataloader'
import { Program } from '../entities/program'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRangeConnectionNode'
import { GradeSummaryNode } from '../types/graphQL/gradeSummaryNode'
import { ProgramSummaryNode } from '../types/graphQL/programSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'

export interface IProgramsConnectionLoaders {
    ageRanges: Lazy<DataLoader<string, AgeRangeConnectionNode[]>>
    grades: Lazy<DataLoader<string, GradeSummaryNode[]>>
    subjects: Lazy<DataLoader<string, SubjectSummaryNode[]>>
}

export interface IProgramNodeDataLoaders {
    node: Lazy<NodeDataLoader<Program, ProgramSummaryNode>>
}

export const ageRangesForPrograms = async (
    programIds: readonly string[]
): Promise<AgeRangeConnectionNode[][]> => {
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.age_ranges', 'AgeRanges')
        .where('Program.id IN (:...ids)', { ids: programIds })

    const programs = new Map(
        (await scope.getMany()).map((program) => [program.id, program])
    )

    return Promise.all(
        programIds.map(async (id) => {
            const ageRanges = (await programs.get(id)?.age_ranges) ?? []

            return Promise.all(
                ageRanges.map(async (ageRange) => {
                    return {
                        id: ageRange.id,
                        name: ageRange.name,
                        lowValue: ageRange.low_value,
                        highValue: ageRange.high_value,
                        lowValueUnit: ageRange.low_value_unit,
                        highValueUnit: ageRange.high_value_unit,
                        status: ageRange.status,
                        system: !!ageRange.system,
                    }
                })
            )
        })
    )
}

export const gradesForPrograms = async (
    programIds: readonly string[]
): Promise<GradeSummaryNode[][]> => {
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.grades', 'Grades')
        .where('Program.id IN (:...ids)', { ids: programIds })

    const programs = new Map(
        (await scope.getMany()).map((program) => [program.id, program])
    )

    return Promise.all(
        programIds.map(async (id) => {
            const grades = (await programs.get(id)?.grades) ?? []

            return Promise.all(
                grades.map(async (grade) => {
                    return {
                        id: grade.id,
                        name: grade.name,
                        status: grade.status,
                        system: !!grade.system,
                    }
                })
            )
        })
    )
}

export const subjectsForPrograms = async (
    programIds: readonly string[]
): Promise<SubjectSummaryNode[][]> => {
    const scope = await Program.createQueryBuilder('Program')
        .leftJoinAndSelect('Program.subjects', 'Subjects')
        .where('Program.id IN (:...ids)', { ids: programIds })

    const programs = new Map(
        (await scope.getMany()).map((program) => [program.id, program])
    )

    return Promise.all(
        programIds.map(async (id) => {
            const subjects = (await programs.get(id)?.subjects) ?? []

            return Promise.all(
                subjects.map(async (subject) => {
                    return {
                        id: subject.id,
                        name: subject.name,
                        status: subject.status,
                        system: !!subject.system,
                    }
                })
            )
        })
    )
}
