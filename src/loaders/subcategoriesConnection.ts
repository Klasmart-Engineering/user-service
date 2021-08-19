import DataLoader from 'dataloader'
import { SelectQueryBuilder } from 'typeorm'
import { Subcategory } from '../entities/subcategory'
import { CategorySummaryNode } from '../types/graphQL/categorySummaryNode'
import { ProgramSummaryNode } from '../types/graphQL/programSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
import { SUMMARY_ELEMENTS_LIMIT } from '../types/paginationConstants'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'

export interface ISubcategoriesConnectionLoaders {
    categories?: DataLoader<string, CategorySummaryNode[]>
    subjects?: DataLoader<string, SubjectSummaryNode[]>
    programs?: DataLoader<string, ProgramSummaryNode[]>
}

export const categoriesForSubcategories = async (
    subcategoryIds: readonly string[],
    filter?: IEntityFilter
): Promise<CategorySummaryNode[][]> => {
    const subcategoryCategories: CategorySummaryNode[][] = []
    const scope = await Subcategory.createQueryBuilder('Subcategory')
        .leftJoinAndSelect('Subcategory.categories', 'Category')
        .distinctOn(['Category.name', 'Subcategory.id'])
        .where('Subcategory.id IN (:...ids)', { ids: subcategoryIds })

    if (filter) {
        addFilterJoins(filter, scope)
    }

    const subcategories = await scope.getMany()

    for (const subcategoryId of subcategoryIds) {
        const subcategory = subcategories.find((s) => s.id === subcategoryId)

        if (subcategory) {
            let counter = 0
            const currentCategories: CategorySummaryNode[] = []
            const categories = (await subcategory.categories) || []

            for (const category of categories) {
                // summary elements have a limit
                if (counter === SUMMARY_ELEMENTS_LIMIT) {
                    break
                }

                counter += 1
                currentCategories.push({
                    id: category.id,
                    name: category.name,
                    status: category.status,
                    system: !!category.system,
                })
            }

            subcategoryCategories.push(currentCategories)
        } else {
            subcategoryCategories.push([])
        }
    }

    return subcategoryCategories
}

export const subjectsForSubcategories = async (
    subcategoryIds: readonly string[],
    filter?: IEntityFilter
): Promise<SubjectSummaryNode[][]> => {
    const subcategorySubjects: SubjectSummaryNode[][] = []
    const scope = await Subcategory.createQueryBuilder('Subcategory')
        .leftJoinAndSelect('Subcategory.categories', 'Category')
        .leftJoinAndSelect('Category.subjects', 'Subject')
        .distinctOn(['Subject.name', 'Subcategory.id'])
        .where('Subcategory.id IN (:...ids)', { ids: subcategoryIds })

    if (filter) {
        addFilterJoins(filter, scope)
    }

    const subjects = await scope.getRawMany()

    for (const subcategoryId of subcategoryIds) {
        const subjectsInSubcategory = subjects.filter(
            (ss) => ss.Subcategory_id === subcategoryId
        )

        if (subjectsInSubcategory.length) {
            let counter = 0
            const currentSubcategorySubjects: SubjectSummaryNode[] = []
            for (const subject of subjectsInSubcategory) {
                // summary elements have a limit
                if (counter === SUMMARY_ELEMENTS_LIMIT) {
                    break
                }

                counter += 1
                currentSubcategorySubjects.push({
                    id: subject.Subject_id,
                    name: subject.Subject_name,
                    status: subject.Subject_status,
                    system: subject.Subject_system,
                })
            }

            subcategorySubjects.push(currentSubcategorySubjects)
        } else {
            subcategorySubjects.push([])
        }
    }

    return subcategorySubjects
}

export const programsForSubcategories = async (
    subcategoryIds: readonly string[],
    filter?: IEntityFilter
): Promise<ProgramSummaryNode[][]> => {
    const subcategoryPrograms: ProgramSummaryNode[][] = []
    const scope = await Subcategory.createQueryBuilder('Subcategory')
        .leftJoinAndSelect('Subcategory.categories', 'Category')
        .leftJoinAndSelect('Category.subjects', 'Subject')
        .leftJoinAndSelect('Subject.programs', 'Program')
        .distinctOn(['Program.name', 'Subcategory.id'])
        .where('Subcategory.id IN (:...ids)', { ids: subcategoryIds })

    if (filter) {
        addFilterJoins(filter, scope)
    }

    const programs = await scope.getRawMany()

    for (const subcategoryId of subcategoryIds) {
        const programsInSubcategory = programs.filter(
            (ps) => ps.Subcategory_id === subcategoryId
        )

        if (programsInSubcategory.length) {
            let counter = 0
            const currentSubcategoryPrograms: ProgramSummaryNode[] = []
            for (const program of programsInSubcategory) {
                // summary elements have a limit
                if (counter === SUMMARY_ELEMENTS_LIMIT) {
                    break
                }

                counter += 1
                currentSubcategoryPrograms.push({
                    id: program.Program_id,
                    name: program.Program_name,
                    status: program.Program_status,
                    system: program.Program_system,
                })
            }

            subcategoryPrograms.push(currentSubcategoryPrograms)
        } else {
            subcategoryPrograms.push([])
        }
    }

    return subcategoryPrograms
}

// generates the needed joins when a filter is applied
function addFilterJoins(
    filter: IEntityFilter,
    scope: SelectQueryBuilder<Subcategory>
) {
    if (filterHasProperty('organizationId', filter)) {
        scope.leftJoinAndSelect('Subcategory.organization', 'Organization')
    }

    scope.andWhere(
        getWhereClauseFromFilter(filter, {
            status: 'Subcategory.status',
            system: 'Subcategory.system',
            organizationId: 'Organization.organization_id',
        })
    )
}
