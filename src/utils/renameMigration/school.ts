import { EntityManager } from 'typeorm'
import { School } from '../../entities/school'

export async function renameDuplicatedSchools(manager: EntityManager) {
    const duplicatedSchoolNames = await School.createQueryBuilder()
        .select('school_name')
        .groupBy('school_name')
        .having('COUNT(school_name) > 1')
        .getRawMany()

    if (!duplicatedSchoolNames.length) {
        return
    }

    for (const { school_name } of duplicatedSchoolNames) {
        const duplicatedSchools = await School.find({
            where: { school_name },
        })

        duplicatedSchools.shift()

        const whenQuery = duplicatedSchools.reduce(
            (previous, school, index) => {
                const whenString = `WHEN school_id = '${
                    school.school_id
                }' THEN '${school.school_name} [Please change name][${
                    index + 1
                }]' `

                return (previous += whenString)
            },
            ''
        )

        const updateQuery = `UPDATE school SET school_name = CASE ${whenQuery} ELSE school_name END;`
        await manager.query(updateQuery)
    }
}
