import { EntityManager } from 'typeorm'
import { Organization } from '../../entities/organization'
import { Subcategory } from '../../entities/subcategory'
import { SubCategoryRow } from '../../types/csv/subCategoryRow'

export const processSubCategoriesFromCSVRow = async (
    manager: EntityManager,
    {
        organization_name,
        subcategory_name,
    }: SubCategoryRow,
    rowCount: number
) => {
    if (!organization_name || !subcategory_name) {
        throw `missing organization_name or subcategory_name at row ${rowCount}`
    }
    const org = await Organization.findOne({ organization_name })
    if (!org) {
        throw `Organisation at row ${rowCount} doesn't exist`
    }

    const subCategoryExists = await manager.findOne(Subcategory, {where: {name: subcategory_name, organization: org}})
    if (subCategoryExists) {
        throw `Duplicate subcategory ${subcategory_name} for organisation ${organization_name}`
    }

    const s = new Subcategory()
    s.organization = Promise.resolve(org);
    s.name = subcategory_name
    await manager.save(s)
}