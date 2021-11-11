import DataLoader from 'dataloader'
import { Grade } from '../entities/grade'
import { GradeSummaryNode } from '../types/graphQL/grade'
import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'

export interface IGradesConnectionLoaders {
    fromGrade: Lazy<DataLoader<string, GradeSummaryNode | undefined>>
    toGrade: Lazy<DataLoader<string, GradeSummaryNode | undefined>>
}

export interface IGradeNodeDataLoaders {
    node: Lazy<NodeDataLoader<Grade, GradeSummaryNode>>
}

export const fromGradeForGrades = async (
    gradeIds: readonly string[]
): Promise<(GradeSummaryNode | undefined)[]> => {
    const noneSpecifiedGrade = await Grade.findOneOrFail({
        where: {
            name: 'None Specified',
            organization: null,
            system: true,
            status: 'active',
        },
    })

    const scope = await Grade.createQueryBuilder('Grade')
        .leftJoinAndSelect('Grade.progress_from_grade', 'FromGrade')
        .where('Grade.id IN (:...ids)', { ids: gradeIds })

    const grades = new Map(
        (await scope.getMany()).map((grade) => [grade.id, grade])
    )

    return Promise.all(
        gradeIds.map(async (id) => {
            const grade = grades.get(id)
            if (!grade) {
                return undefined
            }

            const currentFromGrade =
                (await grade.progress_from_grade) || noneSpecifiedGrade

            return {
                id: currentFromGrade.id,
                name: currentFromGrade.name,
                status: currentFromGrade.status,
                system: !!currentFromGrade.system,
            }
        })
    )
}

export const toGradeForGrades = async (
    gradeIds: readonly string[]
): Promise<(GradeSummaryNode | undefined)[]> => {
    const noneSpecifiedGrade = await Grade.findOneOrFail({
        where: {
            name: 'None Specified',
            organization: null,
            system: true,
            status: 'active',
        },
    })

    const scope = await Grade.createQueryBuilder('Grade')
        .leftJoinAndSelect('Grade.progress_to_grade', 'ToGrade')
        .where('Grade.id IN (:...ids)', { ids: gradeIds })

    const grades = new Map(
        (await scope.getMany()).map((grade) => [grade.id, grade])
    )

    return Promise.all(
        gradeIds.map(async (id) => {
            const grade = grades.get(id)
            if (!grade) {
                return undefined
            }

            const currentToGrade =
                (await grade.progress_to_grade) || noneSpecifiedGrade

            return {
                id: currentToGrade.id,
                name: currentToGrade.name,
                status: currentToGrade.status,
                system: !!currentToGrade.system,
            }
        })
    )
}
