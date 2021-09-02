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
    const subjectCategories: CategorySummaryNode[][] = []
    const scope = await Subject.createQueryBuilder('Subject')
        .leftJoinAndSelect('Subject.categories', 'Category')
        .where('Subject.id IN (:...ids)', { ids: subjectIds })

    const subjects = await scope.getMany()

    for (const subjectId of subjectIds) {
        const subject = subjects.find((s) => s.id === subjectId)

        if (subject) {
            const currentCategories = await getSubjectCategories(subject)
            subjectCategories.push(currentCategories)
        } else {
            subjectCategories.push([])
        }
    }

    return subjectCategories
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
