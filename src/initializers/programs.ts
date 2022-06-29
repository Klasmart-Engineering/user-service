import { In } from 'typeorm'

import { AgeRange } from '../entities/ageRange'
import { Grade } from '../entities/grade'
import { Program } from '../entities/program'
import { Subject } from '../entities/subject'
import { Status } from '../entities/status'

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
        {
            id: 'b39edb9a-ab91-4245-94a4-eb2b5007c033',
            name: 'Bada Genius',
            subjects: ['66a453b0-d38f-472e-b055-7a94a94d66c4'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
            ],
            grades: ['98461ca1-06a1-432a-97d0-4e1dff33e1a5'],
        },
        {
            id: '4591423a-2619-4ef8-a900-f5d924939d02',
            name: 'Bada Math',
            subjects: ['36c4f793-9aa3-4fb8-84f0-68a2ab920d5a'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '145edddc-2019-43d9-97e1-c5830e7ed689',
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            ],
            grades: [
                'd7e2e258-d4b3-4e95-b929-49ae702de4be',
                '3e7979f6-7375-450a-9818-ddb09b250bb2',
                '81dcbcc6-3d70-4bdf-99bc-14833c57c628',
                '100f774a-3d7e-4be5-9c2c-ae70f40f0b50',
                '9d3e591d-06a6-4fc4-9714-cf155a15b415',
            ],
        },
        {
            id: '7a8c5021-142b-44b1-b60b-275c29d132fe',
            name: 'Bada Read',
            subjects: ['b997e0d1-2dd7-40d8-847a-b8670247e96b'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            ],
            grades: ['98461ca1-06a1-432a-97d0-4e1dff33e1a5'],
        },
        {
            id: '93f293e8-2c6a-47ad-bc46-1554caac99e4',
            name: 'Bada Rhyme',
            subjects: ['49c8d5ee-472b-47a6-8c57-58daf863c2e1'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
            ],
            grades: ['98461ca1-06a1-432a-97d0-4e1dff33e1a5'],
        },
        {
            id: '56e24fa0-e139-4c80-b365-61c9bc42cd3f',
            name: 'Bada Sound',
            subjects: ['b19f511e-a46b-488d-9212-22c0369c8afd'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            ],
            grades: ['98461ca1-06a1-432a-97d0-4e1dff33e1a5'],
        },
        {
            id: 'd1bbdcc5-0d80-46b0-b98e-162e7439058f',
            name: 'Bada STEM',
            subjects: ['29d24801-0089-4b8e-85d3-77688e961efb'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '145edddc-2019-43d9-97e1-c5830e7ed689',
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            ],
            grades: [
                'd7e2e258-d4b3-4e95-b929-49ae702de4be',
                '3e7979f6-7375-450a-9818-ddb09b250bb2',
                '81dcbcc6-3d70-4bdf-99bc-14833c57c628',
                '100f774a-3d7e-4be5-9c2c-ae70f40f0b50',
                '9d3e591d-06a6-4fc4-9714-cf155a15b415',
            ],
        },
        {
            id: 'f6617737-5022-478d-9672-0354667e0338',
            name: 'Bada Talk',
            subjects: ['f037ee92-212c-4592-a171-ed32fb892162'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
            ],
            grades: ['98461ca1-06a1-432a-97d0-4e1dff33e1a5'],
        },
        {
            id: 'cdba0679-5719-47dc-806d-78de42026db6',
            name: 'Bada STEAM 1',
            subjects: ['f12276a9-4331-4699-b0fa-68e8df172843'],
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c',
                'bb7982cd-020f-4e1a-93fc-4a6874917f07',
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a',
                '145edddc-2019-43d9-97e1-c5830e7ed689',
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c',
            ],
            grades: [
                'd7e2e258-d4b3-4e95-b929-49ae702de4be',
                '3e7979f6-7375-450a-9818-ddb09b250bb2',
                '81dcbcc6-3d70-4bdf-99bc-14833c57c628',
                '100f774a-3d7e-4be5-9c2c-ae70f40f0b50',
                '9d3e591d-06a6-4fc4-9714-cf155a15b415',
            ],
        },
        {
            id: '3f98d4a7-6ceb-4a9a-b13a-4f4307ff64d7',
            name: 'C ECE',
            subjects: ['51189ac9-f206-469c-941c-3cda28af8788'], // ESL/EFL
            age_ranges: ['7965d220-619d-400f-8cab-42bd98c7d23c'], // 3-4
            grades: ['4b9c1e70-0178-4c68-897b-dac052a38a80'], // Preschool
        },
        {
            id: '4ba2f36e-a2ab-49b3-a94d-89f46f7dfa1e',
            name: 'Bada STEAM 2',
            subjects: ['7eaeb168-2178-4d0e-9ec7-592c1ab8e7fb'], // STEAM
            age_ranges: [
                '7965d220-619d-400f-8cab-42bd98c7d23c', // 3-4
                'bb7982cd-020f-4e1a-93fc-4a6874917f07', // 4-5
                'fe0b81a4-5b02-4548-8fb0-d49cd4a4604a', // 5-6
                '145edddc-2019-43d9-97e1-c5830e7ed689', // 6-7
                '21f1da64-b6c8-4e74-9fef-09d08cfd8e6c', // 7-8
            ],
            grades: [
                'd7e2e258-d4b3-4e95-b929-49ae702de4be', // PreK-1
                '3e7979f6-7375-450a-9818-ddb09b250bb2', // PreK-2
                '81dcbcc6-3d70-4bdf-99bc-14833c57c628', // K
                '100f774a-3d7e-4be5-9c2c-ae70f40f0b50', // Grade 1
                '9d3e591d-06a6-4fc4-9714-cf155a15b415', // Grade 2
            ],
        },
        {
            id: 'f3a9eba7-5d92-4927-9363-ba0a364db72f',
            name: 'Junior Reading Tutor',
            subjects: [
                'ae899fcf-0f50-4cf8-b633-ef9debfb78a1', // English Language Learning
            ],
            age_ranges: [
                '4cdccdc2-a928-44d4-8298-d63196c86dd1', // 11 - 12 year(s)
                '7cf0d4b8-e26e-4580-93fb-a1fdad39b4df', // 12 - 13 year(s)
                'd493188f-5503-4820-beef-6c6583657ab3', // 13 - 14 year(s)
                'e07cacc3-718d-4c19-948e-57bba80906ee', // 14 - 15 year(s)
                'f58759cd-f65e-4deb-87f1-d972baf38106', // 15 - 16 year(s)
            ],
            grades: [
                '2e590398-267e-4186-857a-412c09d31377', // Grade 5
                'fcdf94da-0cd5-4a8f-a2dd-c7ca5d902745', // Grade 6
                '7bb0efd2-25eb-4c8c-9bae-bd4f379d2635', // Grade 7
                '491e3d8c-a781-48ee-83fb-3d6dc9c98e34', // Grade 8
                '4ac72cb2-b3c4-488d-bf2f-83bf3a0e116d', // Grade 9
                '5437a66d-2625-4ca4-96a0-1f0b39f3731f', // Grade 10
                '16fba7b3-eba8-489b-af3f-a8ae5a9c5ff8', // Grade 11
            ],
        },
        {
            id: '5e366ee1-9b56-41d4-8783-3eefaa4d77b7',
            name: 'Grammar Inside',
            subjects: [
                'aa533437-d846-48a8-a1d7-f0bbf22398f2', // English Language Learning
            ],
            age_ranges: [
                'd493188f-5503-4820-beef-6c6583657ab3', // 13 - 14 year(s)
                'e07cacc3-718d-4c19-948e-57bba80906ee', // 14 - 15 year(s)
                'f58759cd-f65e-4deb-87f1-d972baf38106', // 15 - 16 year(s)
                '175353f5-773a-48bc-9319-c1aa439ad02b', // 16 - 17 year(s)
            ],
            grades: [
                '7bb0efd2-25eb-4c8c-9bae-bd4f379d2635', // Grade 7
                '491e3d8c-a781-48ee-83fb-3d6dc9c98e34', // Grade 8
                '4ac72cb2-b3c4-488d-bf2f-83bf3a0e116d', // Grade 9
                '5437a66d-2625-4ca4-96a0-1f0b39f3731f', // Grade 10
                '16fba7b3-eba8-489b-af3f-a8ae5a9c5ff8', // Grade 11
            ],
        },
        {
            id: '2dc4136b-2872-46d8-af18-49b9fcdb4ed2',
            name: 'Voca',
            subjects: [
                '3f8e1fea-30f4-4b07-8beb-cf8f0404348d', // English Language Learning
            ],
            age_ranges: [
                '04e5b813-7eaf-44f9-8c37-171315e8b296', // 10 - 11 year(s)
                '4cdccdc2-a928-44d4-8298-d63196c86dd1', // 11 - 12 year(s)
                '7cf0d4b8-e26e-4580-93fb-a1fdad39b4df', // 12 - 13 year(s)
                'd493188f-5503-4820-beef-6c6583657ab3', // 13 - 14 year(s)
                'e07cacc3-718d-4c19-948e-57bba80906ee', // 14 - 15 year(s)
                'f58759cd-f65e-4deb-87f1-d972baf38106', // 15 - 16 year(s)
            ],
            grades: [
                '3d4fe0f7-2b4c-4925-8d06-e22b71ee63e0', // Grade 4
                '2e590398-267e-4186-857a-412c09d31377', // Grade 5
                'fcdf94da-0cd5-4a8f-a2dd-c7ca5d902745', // Grade 6
                '7bb0efd2-25eb-4c8c-9bae-bd4f379d2635', // Grade 7
                '491e3d8c-a781-48ee-83fb-3d6dc9c98e34', // Grade 8
            ],
        },
        {
            id: 'c303be8a-8bdc-4dff-aa8b-26dd4229e38b',
            name: 'Junior Listening Tours',
            subjects: [
                '2a89d896-019e-4159-a38c-86824b59f6cc', // English Language Learning
            ],
            age_ranges: [
                'e07cacc3-718d-4c19-948e-57bba80906ee', // 14 - 15 year(s)
                'f58759cd-f65e-4deb-87f1-d972baf38106', // 15 - 16 year(s)
                '175353f5-773a-48bc-9319-c1aa439ad02b', // 16 - 17 year(s)
            ],
            grades: [
                '491e3d8c-a781-48ee-83fb-3d6dc9c98e34', // Grade 8
                '4ac72cb2-b3c4-488d-bf2f-83bf3a0e116d', // Grade 9
                '5437a66d-2625-4ca4-96a0-1f0b39f3731f', // Grade 10
                '16fba7b3-eba8-489b-af3f-a8ae5a9c5ff8', // Grade 11
            ],
        },
    ]

    public async run() {
        for (const systemProgram of this.SYSTEM_PROGRAMS) {
            const programAttributes = {
                id: systemProgram.id,
                name: systemProgram.name,
                system: true,
                status: Status.ACTIVE,
            }

            await Program.createQueryBuilder()
                .insert()
                .into(Program)
                .values(programAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id', 'status'],
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

            const program = await Program.findOneByOrFail({
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
