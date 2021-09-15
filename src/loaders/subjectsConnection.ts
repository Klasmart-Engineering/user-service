import DataLoader from 'dataloader'
import { Subject } from '../entities/subject'
import { CategorySummaryNode } from '../types/graphQL/categorySummaryNode'
import { ProgramSummaryNode } from '../types/graphQL/programSummaryNode'
import { SUMMARY_ELEMENTS_LIMIT } from '../types/paginationConstants'

export interface ISubjectsConnectionLoaders {
    categories?: DataLoader<string, CategorySummaryNode[]>
    programs?: DataLoader<string, ProgramSummaryNode[]>
}

export const categoriesForSubjects = async (
    subjectIds: readonly string[]
): Promise<CategorySummaryNode[][]> => {
    const scope = await Subject.createQueryBuilder('Subject')
        .leftJoinAndSelect('Subject.categories', 'Category')
        .where('Subject.id IN (:...ids)', { ids: subjectIds })

    const subjects = new Map(
        (await scope.getMany()).map((subject) => [subject.id, subject])
    )

    return Promise.all(
        subjectIds.map(async (subjectId) => {
            const subject = subjects.get(subjectId)
            return subject ? getSubjectCategories(subject) : []
        })
    )
}

// gets each subcategory in the given category
async function getSubjectCategories(subject: Subject) {
    let counter = 0
    const categories = (await subject.categories) || []
    const currentCategories: CategorySummaryNode[] = []

    for (const category of categories) {
        // summary elements have a limit
        if (counter === SUMMARY_ELEMENTS_LIMIT) {
            return currentCategories
        }

        counter += 1
        currentCategories.push({
            id: category.id,
            name: category.name,
            status: category.status,
            system: !!category.system,
        })
    }

    return currentCategories
}
