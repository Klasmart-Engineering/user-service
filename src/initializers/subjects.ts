import { In } from 'typeorm'

import { Category } from '../entities/category'
import { Subject } from '../entities/subject'
import { Status } from '../entities/status'

export class SubjectsInitializer {
    SYSTEM_SUBJECTS = [
        {
            id: '5e9a201e-9c2f-4a92-bb6f-1ccf8177bb71',
            name: 'None Specified',
            categories: ['2d5ea951-836c-471e-996e-76823a992689'],
        },
        {
            id: '20d6ca2f-13df-4a7a-8dcb-955908db7baa',
            name: 'Language/Literacy',
            categories: [
                '84b8f87a-7b61-4580-a190-a9ce3fe90dd3',
                'ce9014a4-01a9-49d5-bf10-6b08bc454fc1',
                '61996d3d-a37d-4873-bcdc-03b22fc6977e',
                'e08f3578-a7d4-4cac-b028-ef7a8c93f53f',
                '76cc6f90-86ef-48b7-9138-7b2f0bc378e7',
            ],
        },
        {
            id: '7cf8d3a3-5493-46c9-93eb-12f220d101d0',
            name: 'Math',
            categories: [
                '1080d319-8ce7-4378-9c71-a5019d6b9386',
                'f9d82bdd-4ee2-49dd-a707-133407cdef19',
                'a1c26321-e3a7-4ff2-9f1c-bb1c5e420fb7',
                'c12f363a-633b-4080-bd2b-9ced8d034379',
                'e06ad483-085c-4869-bd88-56d17c7810a0',
            ],
        },
        {
            id: 'fab745e8-9e31-4d0c-b780-c40120c98b27',
            name: 'Science',
            categories: [
                '1cc44ecc-153a-47e9-b6e8-3b1ef94a9dee',
                '0523610d-cf11-47b6-b7ab-bdbf8c3e09b6',
                'd1783a8c-6bcd-492a-ad17-37386df80c56',
                '1ef6ca6c-fbc4-4422-a5cb-2bcd999e4b2b',
                '8488eeac-28bd-4f86-8093-9853b19f51db',
            ],
        },
        {
            id: '66a453b0-d38f-472e-b055-7a94a94d66c4',
            name: 'Language/Literacy',
            categories: [
                'b8c76823-150d-4d83-861e-dce7d7bc4f6d',
                'b4cd42b8-a09b-4f66-a03a-b9f6b6f69895',
                'bcfd9d76-cf05-4ccd-9a41-6b886da661be',
                'c909acad-0c52-4fd3-8427-3b1e90a730da',
                'fa8ff09d-9062-4955-9b20-5fa20757f1d9',
                '29a0ab9e-6364-47b6-b63a-1388a7861c6c',
                '49cbbf19-2ad7-4acb-b8c8-66531578116a',
                'bd55fd6b-73ef-41ed-8a86-d7bbc501e773',
                'dd3dbf0c-2872-433b-8b61-9ea78f3c9e97',
            ],
        },
        {
            id: '36c4f793-9aa3-4fb8-84f0-68a2ab920d5a',
            name: 'Math',
            categories: [
                '2a637bea-c529-4868-8269-d0936696da7e',
                '6933de3e-a568-4d56-8c01-e110bda22926',
                '3af9f093-4153-4348-a097-986c15d1f912',
                'a11a6f56-3ae3-4b70-8daa-30cdb63ef5b6',
                '665616dd-32c2-44c4-91c9-63f7493c9fd3',
            ],
        },
        {
            id: 'b997e0d1-2dd7-40d8-847a-b8670247e96b',
            name: 'Language/Literacy',
            categories: [
                '64e000aa-4a2c-4e2e-9d8d-f779e97bdd73',
                '59c47920-4d0d-477c-a33b-06e7f13873d7',
                '7e887129-1e7d-40dc-8caa-5e1e0197fb4d',
                '9e35379a-c333-4471-937e-ac9eeb89cc77',
                '5c75ab94-c4c8-43b6-a43b-b439f449a7fb',
                'ae82bafe-6513-4288-8951-18d93c07e3f1',
                'c68865b4-2ba3-4608-955c-dcc098291159',
                '61f517d8-2c2e-47fd-a2de-6e86465abc59',
                '26e4aedc-2222-44e1-a375-388b138c695d',
            ],
        },
        {
            id: '49c8d5ee-472b-47a6-8c57-58daf863c2e1',
            name: 'Language/Literacy',
            categories: [
                'bf1cd84d-da71-4111-82c6-e85224ab85ca',
                'ba2db2b5-7f20-4cb7-88ef-cee0fcde7937',
                '07786ea3-ac7b-43e0-bb91-6cd813318185',
                'c3f73955-26f0-49bf-91f7-8c42c81fb9d3',
                'aebc88cd-0673-487b-a194-06e3958670a4',
                '22520430-b13e-43ba-930f-fd051bbbc42a',
                'c3175001-2d1e-4b00-aacf-d188f4ae5cdf',
                '19ac71c4-04e4-4d1c-8526-1acb292b7137',
                'd896bf1a-fb5b-4a57-b833-87b0959ba926',
            ],
        },
        {
            id: 'b19f511e-a46b-488d-9212-22c0369c8afd',
            name: 'Language/Literacy',
            categories: [
                'fc06f364-98fe-487f-97fd-d2d6358dccc6',
                '0e66242a-4733-4970-a055-d0d6486f8674',
                'e63956d9-3a36-40b3-a89d-bd45dc8c3181',
                'b0b983e4-bf3c-4315-912e-67c8de4f9e11',
                '84619bee-0b1f-447f-8208-4a39f32062c9',
                '4b247e7e-dcf9-46a6-a477-a69635142d14',
                '59565e03-8d8f-4475-a231-cfc551f004b5',
                '880bc0fd-0209-4f72-999d-3103f9577edf',
                'bac3d444-6dcc-4d6c-a4d7-fb6c96fcfc72',
            ],
        },
        {
            id: '29d24801-0089-4b8e-85d3-77688e961efb',
            name: 'Science',
            categories: [
                '6090e473-ec19-4bf0-ae5c-2d6a4c793f55',
                'da9fa132-dcf7-4148-9037-b381850ba088',
                '585f38e6-f7be-45f2-855a-f2a4bddca125',
                'c3ea1b4a-d220-4248-9b3f-07559b415c56',
                '7826ff58-25d0-41f1-b38e-3e3a77ed32f6',
            ],
        },
        {
            id: 'f037ee92-212c-4592-a171-ed32fb892162',
            name: 'Language/Literacy',
            categories: [
                '1bb26398-3e38-441e-9a8a-460057f2d8c0',
                'e65ea6b4-7093-490a-927e-d2235643f6ca',
                '88fff890-d614-4b88-be57-b7441fa40b66',
                'b18d60c6-a545-46ff-8988-cd5d46ab9660',
                'c83fd174-6504-4cc3-9175-2728d023c39d',
                'd17f1bee-cdef-4759-8c23-3e9b64d08ec1',
                'dd59f36d-717f-4982-9ae6-df32537faba0',
                '8d464354-16d9-41af-b887-103f18f4b376',
                'dfed32b5-f0bd-42ea-999b-e10b376038d5',
            ],
        },
        {
            id: 'f12276a9-4331-4699-b0fa-68e8df172843',
            name: 'STEAM',
            categories: [
                '70d1dff5-4b5a-4029-98e8-8d9fd531b509',
                '17e2dc7e-4911-4a73-9ff0-06baba99900f',
                '51ae3bca-0e55-465c-8302-6fdf132fa316',
                '1d3b076f-0968-4a06-bbaa-18cff13f3db8',
                'dafb0af8-877f-4af4-99b1-79d1a67de059',
            ],
        },
        {
            id: '51189ac9-f206-469c-941c-3cda28af8788',
            name: 'ESL/EFL',
            categories: [
                '0f4810e7-5ce1-47e1-8aeb-43b73f15b007', // Speech & Language Skills
                'd5995392-11cb-4d28-a96d-8bdcd3f0436b', // Fine Motor Skills
                '94013867-72d1-44e2-a43d-7336818f35d0', // Gross Motor Skills
                '2b9d6317-298b-4aa5-9aea-aed56bd07823', // Cognitive Skills
                'fc447234-af24-4768-b617-ac1b80ebae9b', // Social & Emotional Skills
                'd68c6c5d-c739-46d8-be70-e70d6c565949', // Core Subjects
            ],
        },
    ]

    public async run() {
        for (const systemSubject of this.SYSTEM_SUBJECTS) {
            const subjectAttributes = {
                id: systemSubject.id,
                name: systemSubject.name,
                system: true,
                organization_id: null,
                status: Status.ACTIVE,
            }

            await Subject.createQueryBuilder()
                .insert()
                .into(Subject)
                .values(subjectAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id', 'status'],
                })
                .execute()

            const categories =
                (await Category.find({
                    where: { id: In(systemSubject.categories) },
                })) || []

            const subject = await Subject.findOneByOrFail({
                id: systemSubject.id,
            })

            subject.categories = Promise.resolve(categories)

            await subject.save()
        }
    }
}

export default new SubjectsInitializer()
