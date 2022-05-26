import { EntityManager, IsNull } from 'typeorm'
import { Organization } from '../../entities/organization'

export async function renameDuplicatedOrganizations(manager: EntityManager) {
    const whenStrings: string[] = []
    const duplicatedOrganizationNames = await Organization.createQueryBuilder()
        .select('organization_name')
        .groupBy('organization_name')
        .having('COUNT(organization_name) > 1')
        .getRawMany()

    if (!duplicatedOrganizationNames.length) {
        return
    }

    for (const { organization_name } of duplicatedOrganizationNames) {
        const duplicatedOrganizations = await Organization.find({
            where: { organization_name },
        })

        duplicatedOrganizations.shift()

        duplicatedOrganizations.forEach((org, index) => {
            const whenString = `WHEN organization_id = '${
                org.organization_id
            }' THEN '${org.organization_name} [Please change name]${
                index ? `[${index + 1}]'` : `'`
            }`

            whenStrings.push(whenString)
        })
    }

    const whenQuery = whenStrings.join(' ')
    const updateQuery = `UPDATE organization SET organization_name = CASE ${whenQuery} ELSE organization_name END;`
    await manager.query(updateQuery)
}

export async function renameNullOrganizations(manager: EntityManager) {
    const whenStrings: string[] = []
    const nullOrganizations = await Organization.find({
        where: { organization_name: IsNull() },
    })

    if (!nullOrganizations.length) {
        return
    }

    nullOrganizations.forEach((org, index) => {
        const whenString = `WHEN organization_id = '${
            org.organization_id
        }' THEN '[Please assign a name]${index ? `[${index + 1}]'` : `'`}`

        whenStrings.push(whenString)
    })

    const whenQuery = whenStrings.join(' ')
    const updateQuery = `UPDATE organization SET organization_name = CASE ${whenQuery} ELSE organization_name END;`
    await manager.query(updateQuery)
}
