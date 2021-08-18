import DataLoader from 'dataloader'
import { SelectQueryBuilder } from 'typeorm'
import { Program } from '../entities/program'
import { Subcategory } from '../entities/subcategory'
import { Subject } from '../entities/subject'
import { CategorySummaryNode } from '../types/graphQL/categorySummaryNode'
import { ProgramSummaryNode } from '../types/graphQL/programSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
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
            const currentCategories: CategorySummaryNode[] = []
            const categories = (await subcategory.categories) || []

            for (const category of categories) {
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

    const subcategories = await scope.getMany()

    for (const subcategoryId of subcategoryIds) {
        const subcategory = subcategories.find((s) => s.id === subcategoryId)

        if (subcategory) {
            let subjects: Subject[]
            const currentSubjects: SubjectSummaryNode[] = []
            const categories = (await subcategory.categories) || []

            for (const category of categories) {
                subjects = (await category.subjects) || []

                for (const subject of subjects) {
                    currentSubjects.push({
                        id: subject.id,
                        name: subject.name,
                        status: subject.status,
                        system: !!subject.system,
                    })
                }
            }

            subcategorySubjects.push(currentSubjects)
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

    const subcategories = await scope.getMany()

    for (const subcategoryId of subcategoryIds) {
        const subcategory = subcategories.find((s) => s.id === subcategoryId)

        if (subcategory) {
            let subjects: Subject[]
            let programs: Program[]
            const currentPrograms: ProgramSummaryNode[] = []
            const categories = (await subcategory.categories) || []

            for (const category of categories) {
                subjects = (await category.subjects) || []

                for (const subject of subjects) {
                    programs = (await subject.programs) || []

                    for (const program of programs) {
                        currentPrograms.push({
                            id: program.id,
                            name: program.name,
                            status: program.status,
                            system: !!program.system,
                        })
                    }
                }
            }

            subcategoryPrograms.push(currentPrograms)
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
            organizationId: 'Organization.organization_id',
        })
    )
}
