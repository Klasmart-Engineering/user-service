import { In } from 'typeorm'

import { Category } from '../entities/category'
import { Subcategory } from '../entities/subcategory'

export class CategoriesInitializer {
    SYSTEM_CATEGORIES = [
        {
            id: '2d5ea951-836c-471e-996e-76823a992689',
            name: 'Non specified',
            subcategories: ['40a232cd-d6e8-4ec1-97ec-4e4df7d00a78'],
        },
        {
            id: '84b8f87a-7b61-4580-a190-a9ce3fe90dd3',
            name: 'Speech & Language Skills',
            subcategories: [
                '2b6b5d54-0243-4c7e-917a-1627f107f198',
                '8b955cbc-6808-49b2-adc0-5bec8b59f4fe',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
            ],
        },
        {
            id: 'ce9014a4-01a9-49d5-bf10-6b08bc454fc1',
            name: 'Fine Motor Skills',
            subcategories: ['963729a4-7853-49d2-b75d-2c61d291afee'],
        },
        {
            id: '61996d3d-a37d-4873-bcdc-03b22fc6977e',
            name: 'Gross Motor Skills',
            subcategories: ['bd7adbd0-9ce7-4c50-aa8e-85b842683fb5'],
        },
        {
            id: 'e08f3578-a7d4-4cac-b028-ef7a8c93f53f',
            name: 'Cognitive Skills',
            subcategories: ['b32321db-3b4a-4b1e-8db9-c485d045bf01'],
        },
        {
            id: '76cc6f90-86ef-48b7-9138-7b2f0bc378e7',
            name: 'Personal Development',
            subcategories: ['ba77f705-9087-4424-bff9-50fcd0b1731e'],
        },
        {
            id: '1080d319-8ce7-4378-9c71-a5019d6b9386',
            name: 'Speech & Language Skills',
            subcategories: [
                '43c9d2c5-7a23-42c9-8ad9-1132fb9c3853',
                '8d49bbbb-b230-4d5a-900b-cde6283519a3',
                'ed88dcc7-30e4-4ec7-bccd-34aaacb47139',
                '1cb17f8a-d516-498c-97ea-8ad4d7a0c018',
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '39ac1475-4ade-4d0b-b79a-f31256521297',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
            ],
        },
        {
            id: 'f9d82bdd-4ee2-49dd-a707-133407cdef19',
            name: 'Fine Motor Skills',
            subcategories: ['963729a4-7853-49d2-b75d-2c61d291afee'],
        },
        {
            id: 'a1c26321-e3a7-4ff2-9f1c-bb1c5e420fb7',
            name: 'Gross Motor Skills',
            subcategories: [
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
            ],
        },
        {
            id: 'c12f363a-633b-4080-bd2b-9ced8d034379',
            name: 'Cognitive Skills',
            subcategories: [
                '43c9d2c5-7a23-42c9-8ad9-1132fb9c3853',
                '8d49bbbb-b230-4d5a-900b-cde6283519a3',
                'ed88dcc7-30e4-4ec7-bccd-34aaacb47139',
                '1cb17f8a-d516-498c-97ea-8ad4d7a0c018',
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '39ac1475-4ade-4d0b-b79a-f31256521297',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
            ],
        },
        {
            id: 'e06ad483-085c-4869-bd88-56d17c7810a0',
            name: 'Personal Development',
            subcategories: [
                'ba77f705-9087-4424-bff9-50fcd0b1731e',
                '824bb6cb-0169-4335-b7a5-6ece2b929da3',
            ],
        },
        {
            id: '1cc44ecc-153a-47e9-b6e8-3b1ef94a9dee',
            name: 'Speech & Language Skills',
            subcategories: [
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '39ac1475-4ade-4d0b-b79a-f31256521297',
            ],
        },
        {
            id: '0523610d-cf11-47b6-b7ab-bdbf8c3e09b6',
            name: 'Fine Motor Skills',
            subcategories: [
                '963729a4-7853-49d2-b75d-2c61d291afee',
                'bf89c192-93dd-4192-97ab-f37198548ead',
            ],
        },
        {
            id: 'd1783a8c-6bcd-492a-ad17-37386df80c56',
            name: 'Gross Motor Skills',
            subcategories: [
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
            ],
        },
        {
            id: '1ef6ca6c-fbc4-4422-a5cb-2bcd999e4b2b',
            name: 'Cognitive Skills',
            subcategories: [
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '39ac1475-4ade-4d0b-b79a-f31256521297',
                '19803be1-0503-4232-afc1-e6ef06186523',
            ],
        },
        {
            id: '8488eeac-28bd-4f86-8093-9853b19f51db',
            name: 'Personal Development',
            subcategories: [
                'ba77f705-9087-4424-bff9-50fcd0b1731e',
                '824bb6cb-0169-4335-b7a5-6ece2b929da3',
            ],
        },
    ]

    public async run() {
        for (const systemCategory of this.SYSTEM_CATEGORIES) {
            const categoryAttributes = {
                id: systemCategory.id,
                name: systemCategory.name,
                system: true,
                organization_id: null,
            }

            await Category.createQueryBuilder()
                .insert()
                .into(Category)
                .values(categoryAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id'],
                })
                .execute()

            const subcategories =
                (await Subcategory.find({
                    where: { id: In(systemCategory.subcategories) },
                })) || []

            const category = await Category.findOneOrFail({
                id: systemCategory.id,
            })
            category.subcategories = Promise.resolve(subcategories)
            await category.save()
        }
    }
}

export default new CategoriesInitializer()
