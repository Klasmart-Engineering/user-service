import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { SubCategoryRow } from '../../types/csv/subCategoryRow'
import { saveError } from './readFile'

export const processSubCategoriesFromCSVRow = async (
    manager: EntityManager,
    { organization_name, subcategory_name }: SubCategoryRow,
    rowCount: number,
    fileErrors: string[]
) => {
    const requiredFieldsAreProvided = organization_name && subcategory_name
    if (!organization_name) {
        saveError(fileErrors, rowCount, 'missing organization_name')
    }

    if (!subcategory_name) {
        saveError(fileErrors, rowCount, 'missing subcategory_name')
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const org = await Organization.findOne({ organization_name })

    if (!org) {
        saveError(fileErrors, rowCount, "Organisation doesn't exist")
        return
    }

    const subCategoryExists = await manager.findOne(Subcategory, {
        where: { name: subcategory_name, organization: org },
    })

    if (subCategoryExists) {
        saveError(
            fileErrors,
            rowCount,
            `Duplicate subcategory ${subcategory_name} for organisation ${organization_name}`
        )
        return
    }

    const s = new Subcategory()
    s.organization = Promise.resolve(org)
    s.name = subcategory_name
    await manager.save(s)
}
