import { EntityManager } from 'typeorm'
import { Subject } from '../../entities/subject'

export async function renameDuplicatedSubjects(manager: EntityManager) {
    const whenStrings: string[] = []
    const duplicatedSubjectNames = await Subject.createQueryBuilder()
        .select('name, organization_id')
        .where('system != true')
        .groupBy('name, organization_id')
        .having('COUNT(name) > 1')
        .getRawMany()

    if (!duplicatedSubjectNames.length) {
        return
    }

    for (const { name, organization_id } of duplicatedSubjectNames) {
        const duplicatedSubjects = await Subject.find({
            where: { name, organization: { organization_id } },
        })

        duplicatedSubjects.shift()
        duplicatedSubjects.forEach((subject, index) => {
            const indexNum = index ? `[${index + 1}]` : ''
            const whenString = `WHEN id = '${subject.id}' THEN '${subject.name} [Please change name]${indexNum}'`

            whenStrings.push(whenString)
        })
    }

    const whenQuery = whenStrings.join(' ')
    const updateQuery = `UPDATE subject SET name = CASE ${whenQuery} ELSE name END;`

    await manager.query(updateQuery)
}
