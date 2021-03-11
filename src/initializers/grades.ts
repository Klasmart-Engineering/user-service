import { Grade } from '../entities/grade'

export class GradesInitializer {
    SYSTEM_GRADES = [
        {
            id: '98461ca1-06a1-432a-97d0-4e1dff33e1a5',
            name: 'Non specified',
            system: true,
        },
        {
            id: '0ecb8fa9-d77e-4dd3-b220-7e79704f1b03',
            name: 'PreK-1',
            progress_from_grade: 'Non specified',
            progress_to_grade: 'PreK-2',
            system: true,
        },
        {
            id: '66fcda51-33c8-4162-a8d1-0337e1d6ade3',
            name: 'PreK-2',
            progress_from_grade: 'PreK-1',
            progress_to_grade: 'Kindergarten',
            system: true,
        },
        {
            id: 'a9f0217d-f7ec-4add-950d-4e8986ab2c82',
            name: 'Kindergarten',
            progress_from_grade: 'PreK-2',
            progress_to_grade: 'Grade 1',
            system: true,
        },
        {
            id: 'e4d16af5-5b8f-4051-b065-13acf6c694be',
            name: 'Grade 1',
            progress_from_grade: 'Kindergarten',
            progress_to_grade: 'Non specified',
            system: true,
        },
        {
            id: 'b20eaf10-3e40-4ef7-9d74-93a13782d38f',
            name: 'PreK-3',
            progress_from_grade: 'Non specified',
            progress_to_grade: 'PreK-4',
            system: true,
        },
        {
            id: '89d71050-186e-4fb2-8cbd-9598ca312be9',
            name: 'PreK-4',
            progress_from_grade: 'PreK-3',
            progress_to_grade: 'PreK-5',
            system: true,
        },
        {
            id: 'abc900b9-5b8c-4e54-a4a8-54f102b2c1c6',
            name: 'PreK-5',
            progress_from_grade: 'PreK-4',
            progress_to_grade: 'PreK-6',
            system: true,
        },
        {
            id: '3ee3fd4c-6208-494f-9551-d48fabc4f42a',
            name: 'PreK-6',
            progress_from_grade: 'PreK-5',
            progress_to_grade: 'PreK-7',
            system: true,
        },
        {
            id: '781e8a08-29e8-4171-8392-7e8ac9f183a0',
            name: 'PreK-7',
            progress_from_grade: 'PreK-6',
            progress_to_grade: 'Non specified',
            system: true,
        },
    ]

    public async run() {
        for (const systemGrade of this.SYSTEM_GRADES) {
            const gradeAttributes = {
                id: systemGrade.id,
                name: systemGrade.name,
                system: true,
                organization_id: null,
            }

            await Grade.createQueryBuilder()
                .insert()
                .into(Grade)
                .values(gradeAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id'],
                })
                .execute()
        }

        for (const systemGrade of this.SYSTEM_GRADES) {
            const grade = await Grade.findOneOrFail({ id: systemGrade.id })
            const fromGrade = await Grade.findOne({
                name: systemGrade.progress_from_grade,
                system: systemGrade.system,
            })
            const toGrade = await Grade.findOne({
                name: systemGrade.progress_to_grade,
                system: systemGrade.system,
            })

            if (fromGrade && toGrade) {
                grade.progress_from_grade = Promise.resolve(fromGrade)
                grade.progress_to_grade = Promise.resolve(toGrade)

                await grade.save()
            }
        }
    }
}

export default new GradesInitializer()
