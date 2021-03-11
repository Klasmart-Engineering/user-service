import { Subcategory } from '../entities/subcategory'

export class SubcategoriesInitializer {
    SYSTEM_SUBCATEGORIES = [
        { id: '40a232cd-d6e8-4ec1-97ec-4e4df7d00a78', name: 'Non specified' },
        {
            id: '2b6b5d54-0243-4c7e-917a-1627f107f198',
            name: 'Speaking & Listening',
        },
        { id: '8b955cbc-6808-49b2-adc0-5bec8b59f4fe', name: 'Phonics' },
        { id: '2d1152a3-fb03-4c4e-aeba-98856c3241bd', name: 'Vocabulary' },
        { id: '963729a4-7853-49d2-b75d-2c61d291afee', name: 'Sensory' },
        {
            id: 'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
            name: 'Simple Movements',
        },
        { id: 'b32321db-3b4a-4b1e-8db9-c485d045bf01', name: 'Logic & Memory' },
        { id: 'ba77f705-9087-4424-bff9-50fcd0b1731e', name: 'Social Skills' },
        {
            id: '824bb6cb-0169-4335-b7a5-6ece2b929da3',
            name: 'Emotional Skills',
        },
        { id: '43c9d2c5-7a23-42c9-8ad9-1132fb9c3853', name: 'Colors' },
        { id: '8d49bbbb-b230-4d5a-900b-cde6283519a3', name: 'Numbers' },
        { id: 'ed88dcc7-30e4-4ec7-bccd-34aaacb47139', name: 'Shapes' },
        { id: '1cb17f8a-d516-498c-97ea-8ad4d7a0c018', name: 'Letters' },
        { id: 'cd06e622-a323-40f3-8409-5384395e00d2', name: 'Science' },
        { id: '81b09f61-4509-4ce0-b099-c208e62870f9', name: 'Math' },
        { id: '39ac1475-4ade-4d0b-b79a-f31256521297', name: 'Coding' },
        {
            id: 'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
            name: 'Complex Movements',
        },
        { id: 'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67', name: 'Physical Skills' },
        {
            id: 'bf89c192-93dd-4192-97ab-f37198548ead',
            name: 'Hand-Eye Coordination',
        },
        {
            id: '19803be1-0503-4232-afc1-e6ef06186523',
            name: 'Experimenting & Problem Solving',
        },
    ]

    public async run() {
        for (const systemSubcategory of this.SYSTEM_SUBCATEGORIES) {
            const subcategoryAttributes = {
                id: systemSubcategory.id,
                name: systemSubcategory.name,
                system: true,
                organization_id: null,
            }

            await Subcategory.createQueryBuilder()
                .insert()
                .into(Subcategory)
                .values(subcategoryAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id'],
                })
                .execute()
        }
    }
}

export default new SubcategoriesInitializer()
