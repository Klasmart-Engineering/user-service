import { In } from 'typeorm'

import { Category } from '../entities/category'
import { Subject } from '../entities/subject'

export class SubjectsInitializer {
    SYSTEM_SUBJECTS = [
        {
            id: '5e9a201e-9c2f-4a92-bb6f-1ccf8177bb71',
            name: 'Non specified',
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
    ]

    public async run() {
        for (const systemSubject of this.SYSTEM_SUBJECTS) {
            const subject =
                (await Subject.findOne({ id: systemSubject.id })) ||
                new Subject()

            const categories =
                (await Category.find({
                    where: { id: In(systemSubject.categories) },
                })) || []

            subject.id = systemSubject.id
            subject.name = systemSubject.name
            subject.categories = Promise.resolve(categories)
            subject.system = true
            subject.organization = undefined

            await subject.save()
        }
    }
}

export default new SubjectsInitializer()
