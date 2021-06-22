import DataLoader from 'dataloader'
import { Grade } from '../entities/grade'
import { GradeSummaryNode } from '../types/graphQL/gradeSummaryNode'
import {
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'

export interface IGradesConnectionLoaders {
    fromGrade?: DataLoader<string, GradeSummaryNode | undefined>
    toGrade?: DataLoader<string, GradeSummaryNode | undefined>
}

export const fromGradeForGrades = async (
    gradeIds: readonly string[],
    filter?: IEntityFilter
): Promise<(GradeSummaryNode | undefined)[]> => {
    const noneSpecifiedGrade = await Grade.findOneOrFail({
        where: {
            name: 'None Specified',
            organization: null,
            system: true,
            status: 'active',
        },
    })

    const gradeFromGrades: (GradeSummaryNode | undefined)[] = []
    const scope = await Grade.createQueryBuilder('Grade')
        .leftJoinAndSelect('Grade.organization', 'Organization')
        .leftJoinAndSelect('Grade.progress_from_grade', 'FromGrade')
        .where('Grade.id IN (:...ids)', { ids: gradeIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                system: ['Grade.system'],
                status: ['Grade.status'],
            })
        )
    }

    const grades = await scope.getMany()
    for (const gradeId of gradeIds) {
        const grade = grades.find((g) => g.id === gradeId)

        if (grade) {
            const currentFromGrade =
                (await grade.progress_from_grade) || noneSpecifiedGrade
            const currentFromGradeSummary: GradeSummaryNode = {
                id: currentFromGrade.id,
                name: currentFromGrade.name,
                status: currentFromGrade.status,
                system: !!currentFromGrade.system,
            }

            gradeFromGrades.push(currentFromGradeSummary)
        } else {
            gradeFromGrades.push(undefined)
        }
    }

    return gradeFromGrades
}

export const toGradeForGrades = async (
    gradeIds: readonly string[],
    filter?: IEntityFilter
): Promise<(GradeSummaryNode | undefined)[]> => {
    const noneSpecifiedGrade = await Grade.findOneOrFail({
        where: {
            name: 'None Specified',
            organization: null,
            system: true,
            status: 'active',
        },
    })

    const gradeToGrades: (GradeSummaryNode | undefined)[] = []
    const scope = await Grade.createQueryBuilder('Grade')
        .leftJoinAndSelect('Grade.organization', 'Organization')
        .leftJoinAndSelect('Grade.progress_to_grade', 'ToGrade')
        .where('Grade.id IN (:...ids)', { ids: gradeIds })

    if (filter) {
        scope.andWhere(
            getWhereClauseFromFilter(filter, {
                organizationId: ['Organization.organization_id'],
                system: ['Grade.system'],
                status: ['Grade.status'],
            })
        )
    }

    const grades = await scope.getMany()
    for (const gradeId of gradeIds) {
        const grade = grades.find((g) => g.id === gradeId)

        if (grade) {
            const currentToGrade =
                (await grade.progress_to_grade) || noneSpecifiedGrade
            const currentToGradeSummary: GradeSummaryNode = {
                id: currentToGrade.id,
                name: currentToGrade.name,
                status: currentToGrade.status,
                system: !!currentToGrade.system,
            }
            gradeToGrades.push(currentToGradeSummary)
        } else {
            gradeToGrades.push(undefined)
        }
    }

    return gradeToGrades
}
