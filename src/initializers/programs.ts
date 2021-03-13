import { In } from 'typeorm'

import { AgeRange } from '../entities/ageRange'
import { Grade } from '../entities/grade'
import { Program } from '../entities/program'
import { Subject } from '../entities/subject'

export class ProgramsInitializer {
    SYSTEM_PROGRAMS = [
        {
            id: '7565ae11-8130-4b7d-ac24-1d9dd6f792f2',
            name: 'None Specified',
            subjects: ['5e9a201e-9c2f-4a92-bb6f-1ccf8177bb71'],
            age_ranges: ['023eeeb1-5f72-4fa3-a2a7-63603607ac2b'],
            grades: ['98461ca1-06a1-432a-97d0-4e1dff33e1a5'],
        },
        {
            id: '75004121-0c0d-486c-ba65-4c57deacb44b',
            name: 'ESL',
            subjects: ['20d6ca2f-13df-4a7a-8dcb-955908db7baa'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '145edddc-2019-43d9-97e1-c5830e7ed689',
            ],
            grades: [
                '0ecb8fa9-d77e-4dd3-b220-7e79704f1b03',
                '66fcda51-33c8-4162-a8d1-0337e1d6ade3',
                'a9f0217d-f7ec-4add-950d-4e8986ab2c82',
                'e4d16af5-5b8f-4051-b065-13acf6c694be',
            ],
        },
        {
            id: '14d350f1-a7ba-4f46-bef9-dc847f0cbac5',
            name: 'Math',
            subjects: ['7cf8d3a3-5493-46c9-93eb-12f220d101d0'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '145edddc-2019-43d9-97e1-c5830e7ed689',
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            ],
            grades: [
                'b20eaf10-3e40-4ef7-9d74-93a13782d38f',
                '89d71050-186e-4fb2-8cbd-9598ca312be9',
                'abc900b9-5b8c-4e54-a4a8-54f102b2c1c6',
                '3ee3fd4c-6208-494f-9551-d48fabc4f42a',
                '781e8a08-29e8-4171-8392-7e8ac9f183a0',
            ],
        },
        {
            id: '04c630cc-fabe-4176-80f2-30a029907a33',
            name: 'Science',
            subjects: ['fab745e8-9e31-4d0c-b780-c40120c98b27'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '145edddc-2019-43d9-97e1-c5830e7ed689',
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            ],
            grades: [
                'b20eaf10-3e40-4ef7-9d74-93a13782d38f',
                '89d71050-186e-4fb2-8cbd-9598ca312be9',
                'abc900b9-5b8c-4e54-a4a8-54f102b2c1c6',
                '3ee3fd4c-6208-494f-9551-d48fabc4f42a',
                '781e8a08-29e8-4171-8392-7e8ac9f183a0',
            ],
        },
    ]

    public async run() {
        for (const systemProgram of this.SYSTEM_PROGRAMS) {
            const programAttributes = {
                id: systemProgram.id,
                name: systemProgram.name,
                system: true,
                organization_id: null,
            }

            await Program.createQueryBuilder()
                .insert()
                .into(Program)
                .values(programAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id'],
                })
                .execute()

            const subjects =
                (await Subject.find({
                    where: { id: In(systemProgram.subjects) },
                })) || []
            const ageRanges =
                (await AgeRange.find({
                    where: { id: In(systemProgram.age_ranges) },
                })) || []
            const grades =
                (await Grade.find({
                    where: { id: In(systemProgram.grades) },
                })) || []

            const program = await Program.findOneOrFail({
                id: systemProgram.id,
            })
            program.subjects = Promise.resolve(subjects)
            program.age_ranges = Promise.resolve(ageRanges)
            program.grades = Promise.resolve(grades)

            await program.save()
        }
    }
}

export default new ProgramsInitializer()
