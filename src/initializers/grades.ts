import { Grade } from '../entities/grade'
import { Status } from '../entities/status'
import logger from '../logging'

export class GradesInitializer {
    SYSTEM_GRADES = [
        {
            id: '98461ca1-06a1-432a-97d0-4e1dff33e1a5',
            name: 'None Specified',
        },
        {
            id: '0ecb8fa9-d77e-4dd3-b220-7e79704f1b03',
            name: 'PreK-1',
            progress_from_grade: '98461ca1-06a1-432a-97d0-4e1dff33e1a5',
            progress_to_grade: '66fcda51-33c8-4162-a8d1-0337e1d6ade3',
        },
        {
            id: '66fcda51-33c8-4162-a8d1-0337e1d6ade3',
            name: 'PreK-2',
            progress_from_grade: '0ecb8fa9-d77e-4dd3-b220-7e79704f1b03',
            progress_to_grade: 'a9f0217d-f7ec-4add-950d-4e8986ab2c82',
        },
        {
            id: 'a9f0217d-f7ec-4add-950d-4e8986ab2c82',
            name: 'Kindergarten',
            progress_from_grade: '66fcda51-33c8-4162-a8d1-0337e1d6ade3',
            progress_to_grade: 'e4d16af5-5b8f-4051-b065-13acf6c694be',
        },
        {
            id: 'e4d16af5-5b8f-4051-b065-13acf6c694be',
            name: 'Grade 1',
            progress_from_grade: 'a9f0217d-f7ec-4add-950d-4e8986ab2c82',
            progress_to_grade: '98461ca1-06a1-432a-97d0-4e1dff33e1a5',
        },
        {
            id: 'b20eaf10-3e40-4ef7-9d74-93a13782d38f',
            name: 'PreK-3',
            progress_from_grade: '98461ca1-06a1-432a-97d0-4e1dff33e1a5',
            progress_to_grade: '89d71050-186e-4fb2-8cbd-9598ca312be9',
        },
        {
            id: '89d71050-186e-4fb2-8cbd-9598ca312be9',
            name: 'PreK-4',
            progress_from_grade: 'b20eaf10-3e40-4ef7-9d74-93a13782d38f',
            progress_to_grade: 'abc900b9-5b8c-4e54-a4a8-54f102b2c1c6',
        },
        {
            id: 'abc900b9-5b8c-4e54-a4a8-54f102b2c1c6',
            name: 'PreK-5',
            progress_from_grade: '89d71050-186e-4fb2-8cbd-9598ca312be9',
            progress_to_grade: '3ee3fd4c-6208-494f-9551-d48fabc4f42a',
        },
        {
            id: '3ee3fd4c-6208-494f-9551-d48fabc4f42a',
            name: 'PreK-6',
            progress_from_grade: 'abc900b9-5b8c-4e54-a4a8-54f102b2c1c6',
            progress_to_grade: '781e8a08-29e8-4171-8392-7e8ac9f183a0',
        },
        {
            id: '781e8a08-29e8-4171-8392-7e8ac9f183a0',
            name: 'PreK-7',
            progress_from_grade: '3ee3fd4c-6208-494f-9551-d48fabc4f42a',
            progress_to_grade: '98461ca1-06a1-432a-97d0-4e1dff33e1a5',
        },
        {
            id: 'd7e2e258-d4b3-4e95-b929-49ae702de4be',
            name: 'PreK-1',
            progress_from_grade: '98461ca1-06a1-432a-97d0-4e1dff33e1a5',
            progress_to_grade: '3e7979f6-7375-450a-9818-ddb09b250bb2',
        },
        {
            id: '3e7979f6-7375-450a-9818-ddb09b250bb2',
            name: 'PreK-2',
            progress_from_grade: 'd7e2e258-d4b3-4e95-b929-49ae702de4be',
            progress_to_grade: '81dcbcc6-3d70-4bdf-99bc-14833c57c628',
        },
        {
            id: '81dcbcc6-3d70-4bdf-99bc-14833c57c628',
            name: 'K',
            progress_from_grade: '3e7979f6-7375-450a-9818-ddb09b250bb2',
            progress_to_grade: '100f774a-3d7e-4be5-9c2c-ae70f40f0b50',
        },
        {
            id: '100f774a-3d7e-4be5-9c2c-ae70f40f0b50',
            name: 'Grade 1',
            progress_from_grade: '81dcbcc6-3d70-4bdf-99bc-14833c57c628',
            progress_to_grade: '9d3e591d-06a6-4fc4-9714-cf155a15b415',
        },
        {
            id: '9d3e591d-06a6-4fc4-9714-cf155a15b415',
            name: 'Grade 2',
            progress_from_grade: '100f774a-3d7e-4be5-9c2c-ae70f40f0b50',
            progress_to_grade: '0b49f0cf-fdfd-40c9-8b19-ee8c58b4dd81',
        },
        {
            id: '4b9c1e70-0178-4c68-897b-dac052a38a80',
            name: 'Preschool',
            progress_from_grade: '98461ca1-06a1-432a-97d0-4e1dff33e1a5', // None Specified
            progress_to_grade: 'a9f0217d-f7ec-4add-950d-4e8986ab2c82', // Kindergarten
        },
        {
            id: '0b49f0cf-fdfd-40c9-8b19-ee8c58b4dd81',
            name: 'Grade 3',
            progress_from_grade: '9d3e591d-06a6-4fc4-9714-cf155a15b415', // Grade 2
            progress_to_grade: '3d4fe0f7-2b4c-4925-8d06-e22b71ee63e0', //Grade 4
        },
        {
            id: '3d4fe0f7-2b4c-4925-8d06-e22b71ee63e0',
            name: 'Grade 4',
            progress_from_grade: '0b49f0cf-fdfd-40c9-8b19-ee8c58b4dd81', // Grade 3
            progress_to_grade: '2e590398-267e-4186-857a-412c09d31377', // Grade 5
        },
        {
            id: '2e590398-267e-4186-857a-412c09d31377',
            name: 'Grade 5',
            progress_from_grade: '3d4fe0f7-2b4c-4925-8d06-e22b71ee63e0', // Grade 4
            progress_to_grade: 'fcdf94da-0cd5-4a8f-a2dd-c7ca5d902745', // Grade 6
        },
        {
            id: 'fcdf94da-0cd5-4a8f-a2dd-c7ca5d902745',
            name: 'Grade 6',
            progress_from_grade: '2e590398-267e-4186-857a-412c09d31377', // Grade 5
            progress_to_grade: '7bb0efd2-25eb-4c8c-9bae-bd4f379d2635', // Grade 7
        },
        {
            id: '7bb0efd2-25eb-4c8c-9bae-bd4f379d2635',
            name: 'Grade 7',
            progress_from_grade: 'fcdf94da-0cd5-4a8f-a2dd-c7ca5d902745', // Grade 6
            progress_to_grade: '491e3d8c-a781-48ee-83fb-3d6dc9c98e34', // Grade 8
        },
        {
            id: '491e3d8c-a781-48ee-83fb-3d6dc9c98e34',
            name: 'Grade 8',
            progress_from_grade: '7bb0efd2-25eb-4c8c-9bae-bd4f379d2635', // Grade 7
            progress_to_grade: '4ac72cb2-b3c4-488d-bf2f-83bf3a0e116d', // Grade 9
        },
        {
            id: '4ac72cb2-b3c4-488d-bf2f-83bf3a0e116d',
            name: 'Grade 9',
            progress_from_grade: '491e3d8c-a781-48ee-83fb-3d6dc9c98e34', // Grade 8
            progress_to_grade: '5437a66d-2625-4ca4-96a0-1f0b39f3731f', // Grade 10
        },
        {
            id: '5437a66d-2625-4ca4-96a0-1f0b39f3731f',
            name: 'Grade 10',
            progress_from_grade: '4ac72cb2-b3c4-488d-bf2f-83bf3a0e116d', // Grade 9
            progress_to_grade: '16fba7b3-eba8-489b-af3f-a8ae5a9c5ff8', // Grade 11
        },
        {
            id: '16fba7b3-eba8-489b-af3f-a8ae5a9c5ff8',
            name: 'Grade 11',
            progress_from_grade: '5437a66d-2625-4ca4-96a0-1f0b39f3731f', // Grade 10
            progress_to_grade: '98461ca1-06a1-432a-97d0-4e1dff33e1a5', // None Specified
        },
    ]

    public async run() {
        for (const systemGrade of this.SYSTEM_GRADES) {
            const gradeAttributes = {
                id: systemGrade.id,
                name: systemGrade.name,
                system: true,
                organization_id: null,
                status: Status.ACTIVE,
            }

            await Grade.createQueryBuilder()
                .insert()
                .into(Grade)
                .values(gradeAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id', 'status'],
                })
                .execute()
        }

        for (const systemGrade of this.SYSTEM_GRADES) {
            const grade = await Grade.findOneByOrFail({ id: systemGrade.id })
            const fromGrade = await Grade.findOneBy({
                id: systemGrade.progress_from_grade,
            })

            if (!fromGrade) {
                logger.log(
                    'error',
                    `Could not find fromGrade for ${systemGrade.id} with id: ${systemGrade.progress_from_grade}`
                )
            }

            const toGrade = await Grade.findOneBy({
                id: systemGrade.progress_to_grade,
            })

            if (!toGrade) {
                logger.log(
                    'error',
                    `Could not find toGrade for ${systemGrade.id} with id: ${systemGrade.progress_to_grade}`
                )
            }

            if (fromGrade && toGrade) {
                grade.progress_from_grade = Promise.resolve(fromGrade)
                grade.progress_to_grade = Promise.resolve(toGrade)

                await grade.save()
            }
        }
    }
}

export default new GradesInitializer()
