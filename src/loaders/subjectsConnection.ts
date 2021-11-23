import DataLoader from 'dataloader'
import { Subject } from '../entities/subject'
import { CategoryConnectionNode } from '../types/graphQL/category'
import { SubjectConnectionNode } from '../types/graphQL/subject'
import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'
import { MAX_PAGE_SIZE } from '../utils/pagination/paginate'

export interface ISubjectsConnectionLoaders {
    categories: Lazy<DataLoader<string, CategoryConnectionNode[]>>
}

export interface ISubjectNodeDataLoader {
    node: Lazy<NodeDataLoader<Subject, SubjectConnectionNode>>
}

export const categoriesForSubjects = async (
    subjectIds: readonly string[]
): Promise<CategoryConnectionNode[][]> => {
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
    const currentCategories: CategoryConnectionNode[] = []

    for (const category of categories) {
        // summary elements have a limit
        if (counter === MAX_PAGE_SIZE) {
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
