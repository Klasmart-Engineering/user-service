import DataLoader from 'dataloader'
import { SelectQueryBuilder } from 'typeorm'
import { Category } from '../entities/category'
import { Program } from '../entities/program'
import { ProgramSummaryNode } from '../types/graphQL/programSummaryNode'
import { SubcategorySummaryNode } from '../types/graphQL/subcategorySummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
import { SUMMARY_ELEMENTS_LIMIT } from '../types/paginationConstants'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'

export interface ICategoriesConnectionLoaders {
    subcategories?: DataLoader<string, SubcategorySummaryNode[]>
    subjects?: DataLoader<string, SubjectSummaryNode[]>
    programs?: DataLoader<string, ProgramSummaryNode[]>
}

export const subcategoriesForCategories = async (
    categoryIds: readonly string[],
    filter?: IEntityFilter
): Promise<SubcategorySummaryNode[][]> => {
    const categorySubcategories: SubcategorySummaryNode[][] = []
    const scope = await Category.createQueryBuilder('Category')
        .leftJoinAndSelect('Category.subcategories', 'Subcategory')
        .where('Category.id IN (:...ids)', { ids: categoryIds })

    if (filter) {
        addFilterJoins(filter, scope)
    }

    const categories = await scope.getMany()

    for (const categoryId of categoryIds) {
        const category = categories.find((c) => c.id === categoryId)

        if (category) {
            const currentSubcategories = await getCategorySubcategories(
                category
            )

            categorySubcategories.push(currentSubcategories)
        } else {
            categorySubcategories.push([])
        }
    }

    return categorySubcategories
}

export const subjectsForCategories = async (
    categoryIds: readonly string[],
    filter?: IEntityFilter
): Promise<SubjectSummaryNode[][]> => {
    const categorySubjects: SubjectSummaryNode[][] = []
    const scope = await Category.createQueryBuilder('Category')
        .leftJoinAndSelect('Category.subjects', 'Subject')
        .distinctOn(['Subject.name', 'Category.id'])
        .where('Category.id IN (:...ids)', { ids: categoryIds })

    if (filter) {
        addFilterJoins(filter, scope)
    }

    const categories = await scope.getMany()

    for (const categoryId of categoryIds) {
        const category = categories.find((c) => c.id === categoryId)

        if (category) {
            const currentSubjects = await getCategorySubjects(category)

            categorySubjects.push(currentSubjects)
        } else {
            categorySubjects.push([])
        }
    }

    return categorySubjects
}

export const programsForCategories = async (
    categoryIds: readonly string[],
    filter?: IEntityFilter
): Promise<ProgramSummaryNode[][]> => {
    const categoryPrograms: ProgramSummaryNode[][] = []
    const scope = await Category.createQueryBuilder('Category')
        .leftJoinAndSelect('Category.subjects', 'Subject')
        .leftJoinAndSelect('Subject.programs', 'Program')
        .distinctOn(['Program.name', 'Category.id'])
        .where('Category.id IN (:...ids)', { ids: categoryIds })

    if (filter) {
        addFilterJoins(filter, scope)
    }

    const categories = await scope.getMany()

    for (const categoryId of categoryIds) {
        const category = categories.find((c) => c.id === categoryId)

        if (category) {
            const currentPrograms = await getCategoryPrograms(category)

            categoryPrograms.push(currentPrograms)
        } else {
            categoryPrograms.push([])
        }
    }

    return categoryPrograms
}

// generates the needed joins when a filter is applied
function addFilterJoins(
    filter: IEntityFilter,
    scope: SelectQueryBuilder<Category>
) {
    if (filterHasProperty('organizationId', filter)) {
        scope.leftJoinAndSelect('Category.organization', 'Organization')
    }

    scope.andWhere(
        getWhereClauseFromFilter(filter, {
            status: 'Category.status',
            system: 'Category.system',
            organizationId: 'Organization.organization_id',
        })
    )
}

// gets each subcategory in category
async function getCategorySubcategories(category: Category) {
    let counter = 0
    const subcategories = (await category.subcategories) || []
    const currentSubcategories: SubcategorySummaryNode[] = []

    for (const subcategory of subcategories) {
        // summary elements have a limit
        if (counter === SUMMARY_ELEMENTS_LIMIT) {
            return currentSubcategories
        }

        counter += 1
        currentSubcategories.push({
            id: subcategory.id,
            name: subcategory.name,
            status: subcategory.status,
            system: !!subcategory.system,
        })
    }

    return currentSubcategories
}

// gets each subject in category
async function getCategorySubjects(category: Category) {
    let counter = 0
    const subjects = (await category.subjects) || []
    const currentSubjects: SubjectSummaryNode[] = []

    for (const subject of subjects) {
        // summary elements have a limit
        if (counter === SUMMARY_ELEMENTS_LIMIT) {
            return currentSubjects
        }

        counter += 1
        currentSubjects.push({
            id: subject.id,
            name: subject.name,
            status: subject.status,
            system: !!subject.system,
        })
    }

    return currentSubjects
}

// goes through each subject in category to get the subject's program
async function getCategoryPrograms(category: Category) {
    let counter = 0
    let programs: Program[]
    const subjects = (await category.subjects) || []
    const currentPrograms: ProgramSummaryNode[] = []

    for (const subject of subjects) {
        programs = (await subject.programs) || []

        for (const program of programs) {
            // summary elements have a limit
            if (counter === SUMMARY_ELEMENTS_LIMIT) {
                return currentPrograms
            }

            counter += 1
            currentPrograms.push({
                id: program.id,
                name: program.name,
                status: program.status,
                system: !!program.system,
            })
        }
    }

    return currentPrograms
}
