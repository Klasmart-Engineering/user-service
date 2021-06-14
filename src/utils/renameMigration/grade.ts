import { EntityManager } from 'typeorm'
import { Grade } from '../../entities/grade'

export async function renameDuplicatedGrades(manager: EntityManager) {
    const whenStrings: string[] = []
    const duplicatedGradeNames = await Grade.createQueryBuilder()
        .select('name, organization_id')
        .where('system != true')
        .groupBy('name, organization_id')
        .having('COUNT(name) > 1')
        .getRawMany()

    if (!duplicatedGradeNames.length) {
        return
    }

    for (const { name, organization_id } of duplicatedGradeNames) {
        const duplicatedGrades = await Grade.find({
            where: { name, organization: { organization_id } },
        })

        duplicatedGrades.shift()

        duplicatedGrades.forEach((grade, index) => {
            const indexNum = index ? `[${index + 1}]` : ''
            const whenString = `WHEN id = '${grade.id}' THEN '${grade.name} [Please change name]${indexNum}'`

            whenStrings.push(whenString)
        })
    }

    const whenQuery = whenStrings.join(' ')
    const updateQuery = `UPDATE grade SET name = CASE ${whenQuery} ELSE name END;`
    await manager.query(updateQuery)
}
