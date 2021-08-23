import DataLoader from 'dataloader'
import { Program } from '../entities/program'
import { Subcategory } from '../entities/subcategory'
import { Subject } from '../entities/subject'
import { CategorySummaryNode } from '../types/graphQL/categorySummaryNode'
import { ProgramSummaryNode } from '../types/graphQL/programSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
import { SUMMARY_ELEMENTS_LIMIT } from '../types/paginationConstants'

export interface ISubcategoriesConnectionLoaders {
    categories?: DataLoader<string, CategorySummaryNode[]>
    subjects?: DataLoader<string, SubjectSummaryNode[]>
    programs?: DataLoader<string, ProgramSummaryNode[]>
}

export const categoriesForSubcategories = async (
    subcategoryIds: readonly string[]
): Promise<CategorySummaryNode[][]> => {
    const subcategoryCategories: CategorySummaryNode[][] = []
    const scope = await Subcategory.createQueryBuilder('Subcategory')
        .leftJoinAndSelect('Subcategory.categories', 'Category')
        .distinctOn(['Category.name', 'Subcategory.id'])
        .where('Subcategory.id IN (:...ids)', { ids: subcategoryIds })

    const subcategories = await scope.getMany()

    for (const subcategoryId of subcategoryIds) {
        const subcategory = subcategories.find((s) => s.id === subcategoryId)

        if (subcategory) {
            const currentCategories = await getSubcategoryCategories(
                subcategory
            )

            subcategoryCategories.push(currentCategories)
        } else {
            subcategoryCategories.push([])
        }
    }

    return subcategoryCategories
}

export const subjectsForSubcategories = async (
    subcategoryIds: readonly string[]
): Promise<SubjectSummaryNode[][]> => {
    const subcategorySubjects: SubjectSummaryNode[][] = []
    const scope = await Subcategory.createQueryBuilder('Subcategory')
        .leftJoinAndSelect('Subcategory.categories', 'Category')
        .leftJoinAndSelect('Category.subjects', 'Subject')
        .distinctOn(['Subject.name', 'Subcategory.id'])
        .where('Subcategory.id IN (:...ids)', { ids: subcategoryIds })

    const subcategories = await scope.getMany()

    for (const subcategoryId of subcategoryIds) {
        const subcategory = subcategories.find((s) => s.id === subcategoryId)

        if (subcategory) {
            const currentSubjects = await getSubcategorySubjects(subcategory)
            subcategorySubjects.push(currentSubjects)
        } else {
            subcategorySubjects.push([])
        }
    }

    return subcategorySubjects
}

export const programsForSubcategories = async (
    subcategoryIds: readonly string[]
): Promise<ProgramSummaryNode[][]> => {
    const subcategoryPrograms: ProgramSummaryNode[][] = []
    const scope = await Subcategory.createQueryBuilder('Subcategory')
        .leftJoinAndSelect('Subcategory.categories', 'Category')
        .leftJoinAndSelect('Category.subjects', 'Subject')
        .leftJoinAndSelect('Subject.programs', 'Program')
        .distinctOn(['Program.name', 'Subcategory.id'])
        .where('Subcategory.id IN (:...ids)', { ids: subcategoryIds })

    const subcategories = await scope.getMany()

    for (const subcategoryId of subcategoryIds) {
        const subcategory = subcategories.find((s) => s.id === subcategoryId)

        if (subcategory) {
            const currentPrograms = await getSubcategoryPrograms(subcategory)
            subcategoryPrograms.push(currentPrograms)
        } else {
            subcategoryPrograms.push([])
        }
    }

    return subcategoryPrograms
}

// gets each category in subcategory
async function getSubcategoryCategories(subcategory: Subcategory) {
    let counter = 0
    const categories = (await subcategory.categories) || []
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

// goes through each category in subcategory to get the category's subjects
async function getSubcategorySubjects(subcategory: Subcategory) {
    let counter = 0
    let subjects: Subject[]
    const currentSubjects: SubjectSummaryNode[] = []
    const categories = (await subcategory.categories) || []

    for (const category of categories) {
        subjects = (await category.subjects) || []

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
    }

    return currentSubjects
}

// goes through each subject in each category in subcategory to get the subject's programs
async function getSubcategoryPrograms(subcategory: Subcategory) {
    let counter = 0
    let subjects: Subject[]
    let programs: Program[]
    const currentPrograms: ProgramSummaryNode[] = []
    const categories = (await subcategory.categories) || []

    for (const category of categories) {
        subjects = (await category.subjects) || []

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
    }

    return currentPrograms
}
