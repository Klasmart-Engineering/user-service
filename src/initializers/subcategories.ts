import { Subcategory } from '../entities/subcategory'
import { Status } from '../entities/status'

export class SubcategoriesInitializer {
    SYSTEM_SUBCATEGORIES = [
        { id: '40a232cd-d6e8-4ec1-97ec-4e4df7d00a78', name: 'None Specified' },
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
        {
            id: '0e6b1c2b-5e2f-47e1-8422-2a183f3e15c7',
            name: 'Cognitive Development',
        },
        {
            id: '3fca3a2b-97b6-4ec9-a5b1-1d0ef5f1b445',
            name: 'Reading Skills and Comprehension',
        },
        {
            id: '9b955fb9-8eda-4469-bd31-4e8f91192663',
            name: 'Emergent Writing',
        },
        {
            id: '11351e3f-afc3-476e-b3af-a0c7718269ac',
            name: 'Coloring',
        },
        {
            id: '4ab80faf-60b9-4cc2-8f51-3d3b7f9fee13',
            name: 'Patterns',
        },
        {
            id: 'eb29827a-0053-4eee-83cd-8f4afb1b7cb4',
            name: 'Comprehension',
        },
        {
            id: '188c621a-cbc7-42e2-9d01-56f4847682cb',
            name: 'Empathy',
        },
        {
            id: 'ddf87dff-1eb0-4971-9b27-2aaa534f34b1',
            name: 'Listening',
        },
        {
            id: '644ba535-904c-4919-8b8c-688df2b6f7ee',
            name: 'Emergent Reading',
        },
        {
            id: '7848bb23-2bb9-4108-938b-51f2f7d1d30f',
            name: 'Tracing',
        },
        {
            id: '6fb79402-2fb6-4415-874c-338c949332ed',
            name: 'Art',
        },
        {
            id: '5b405510-384a-4721-a526-e12b3cbf2092',
            name: 'Engineering',
        },
        {
            id: '9a52fb0a-6ce8-45df-92a0-f25b5d3d2344',
            name: 'Music',
        },
        {
            id: '4114f381-a7c5-4e88-be84-2bef4eb04ad0',
            name: 'Health',
        },
        {
            id: '9a9882f1-d890-461c-a710-ca37fb78ddf5',
            name: 'Sight Words',
        },
        {
            id: 'f4b07251-1d67-4a84-bcda-86c71cbf9cfd',
            name: 'Social Studies',
        },
        {
            id: 'b79735db-91c7-4bcb-860b-fe23902f81ea',
            name: 'Social Interactions',
        },
        {
            id: 'c06b848d-8769-44e9-8dc7-929588cec0bc',
            name: 'Speaking',
        },
        {
            id: 'f385c1ec-6cfa-4f49-a219-fd28374cf2a6',
            name: 'Visual',
        },
        {
            id: 'd50cff7c-b0c7-43be-8ec7-877fa4c9a6fb',
            name: 'Drag',
        },
        {
            id: '49e73e4f-8ffc-47e3-9b87-0f9686d361d7',
            name: 'Technology',
        },
        {
            id: 'e2190c0c-918d-4a05-a045-6696ae31d5c4',
            name: 'Click',
        },
        {
            id: '01191172-b276-449f-ab11-8e66e990941e',
            name: 'Reading',
        },
        {
            id: 'b2cc7a69-4e64-4e97-9587-0078dccd845a',
            name: 'Language Support',
        },
        {
            id: '843e4fea-7f4d-4746-87ff-693f5a44b467',
            name: 'Communication',
        },
        {
            id: 'a7850bd6-f5fd-4016-b708-7b823784ef0a',
            name: 'Writing',
        },
        {
            id: '96f81756-70e3-41e5-9143-740376574e35',
            name: 'Social-Emotional Learning',
        },
        {
            id: 'bea9244e-ff17-47fc-8e7c-bceadf0f4f6e',
            name: 'Drawing',
        },
        {
            id: '55cbd434-36ce-4c57-b47e-d7119b578d7e',
            name: 'Fluency',
        },
        {
            id: 'b9d5a570-5be3-491b-9fdc-d26ea1c13847',
            name: 'Reasoning Skills',
        },
        {
            id: '39e96a23-5ac3-47c9-94fc-e71965f75880',
            name: 'Phonemic Awareness, Phonics, and Word Recognition',
        },
        {
            id: '852c3495-1ced-4580-a584-9d475217f3d5',
            name: 'Character Education',
        },
        {
            id: 'a048cf91-2c96-4306-a7c2-cac2fe1d688a',
            name: 'Reasoning',
        },
        {
            id: '367c5e70-1487-4b33-96c0-529a37dbc5f2',
            name: 'Counting and Operations',
        },
        {
            id: '5bb19c81-9261-428e-95ed-c87cc9f0560b',
            name: 'Phonological Awareness',
        },
        {
            id: '6ccc8306-1a9e-42bd-83ff-55bac3449853',
            name: 'Self-Control',
        },
        {
            id: '3b148168-31d0-4bef-9152-63c3ff516180',
            name: 'Miscellaneous',
        },
        {
            id: '9a1e0589-0361-40e1-851c-b95b641e271e',
            name:
                'Critical Thinking (Interpretation, Analysis, Evaluation, Inference, Explanation, and Self-Regulation)',
        },
        {
            id: '9c30644b-0e9c-43aa-a19a-442e9f6aa6ae',
            name: 'Body Coordination',
        },
        {
            id: 'e45ff0ff-40a4-4be4-ab26-426aedba7597',
            name: 'Spatial Representation',
        },
        {
            id: 'ff838eb9-11b9-4de5-b854-a24d4d526f5e',
            name: 'Logical Problem-Solving',
        },
        {
            id: '0fd7d721-df1b-41eb-baa4-08ba4ac2b2e7',
            name: 'Thematic Concepts',
        },
        {
            id: '8d3f987a-7f7c-4035-a709-9526060b2177',
            name:
                'Science Process (Observing, Classifying, Communicating, Measuring, Predicting)',
        },
        {
            id: 'ec1d6481-ab50-42b6-a4b5-1a5fb98796d0',
            name: 'Phonemic Awareness',
        },
        {
            id: '144a3478-1946-4460-a965-0d7d74e63d65',
            name: 'Physical Coordination',
        },
        {
            id: 'c79be603-ccf4-4284-9c8e-61b55ec53067',
            name: 'Self-Identity',
        },
        {
            id: '47169b0a-ac39-4e25-bd6e-77eecaf4e051',
            name: 'Interpreting',
        },
        {
            id: '3e7c719b-aa3c-45c3-87ac-08ae0e6138b1',
            name: "Animal's Needs",
        },
        {
            id: 'b60f9fa0-a160-42e2-9cea-9ec39de2692a',
            name: 'Classification',
        },
        {
            id: '7dfc3b4c-3037-42f6-89be-75839e8ab40d',
            name: 'Food',
        },
        {
            id: '60c8428a-98db-445f-9a91-fbddb20eb315',
            name: 'Adaptations',
        },
        {
            id: 'db49ef2b-e680-488f-a241-dd5c0f0ee727',
            name: 'Environment',
        },
        {
            id: 'eca38066-c702-4ca0-a1e7-420d8becf687',
            name: 'Senses',
        },
        {
            id: '92055ac9-45a8-4905-b713-e7b6473593f6',
            name: 'Growth & Development',
        },
        {
            id: 'b39b4fe4-2bc1-4d92-a8e3-ce163f6a3306',
            name: 'Habitats',
        },
        {
            id: '00878904-73cc-4fb8-8ef6-9676cf89dd74',
            name: 'Plants & Food Chains',
        },
        {
            id: 'fe0766c7-0c91-4652-b1fe-e949590cb9a2',
            name: 'Movement & Interactions',
        },
        {
            id: 'e601b3ef-5bcc-4dda-bf37-47244a63d067',
            name: 'Ecosystems',
        },
        {
            id: '76cc0ed5-c00c-42f3-9e3b-7d1355e2d9c0',
            name: 'Endangered Species & Extinction',
        },
        {
            id: '26654f67-ddc4-493d-9bc3-f260d8125d20',
            name: 'Sets and Sorting',
        },
        {
            id: '485eb5a6-73a3-497e-8d19-51cd9c10b323',
            name: 'Uses of Number',
        },
        {
            id: 'c9dd0e2a-608c-4833-9bf6-b73d51dfd7eb',
            name: 'Numerosity',
        },
        {
            id: '4c523f7b-88ca-4e47-b0e3-27b66caf696b',
            name: 'Quantity',
        },
        {
            id: 'c5e36c28-2d3d-43e1-b35a-2cd9a60a30c9',
            name: 'Counting Rules',
        },
        {
            id: '56ec83c8-39c7-462e-bd2b-365f2a7aae72',
            name: 'Creative Thinking Skills',
        },
        {
            id: '5fff3596-42e9-416d-a2d2-29bc885fbb76',
            name: 'Social Emotional',
        },
        {
            id: '38c17083-2ef7-402b-824a-20c38e3c57f4',
            name: 'Phonological Awareness & Phonics',
        },
        {
            id: '7d3b5cb0-d9d2-42e8-b1f7-f58743edffdf',
            name: 'Sensory Play',
        },
        {
            id: '8eb1ba6c-4bac-457c-a798-821ddafcedee',
            name: 'Self-Care',
        },
        {
            id: '223f3157-feb2-41ea-8c03-8a355b67343c',
            name: 'Academic Skills',
        },
        {
            id: '94a39407-035c-46e0-a039-357a33e9723a',
            name: 'Learning Tools',
        },
        {
            id: '6ff4c1af-252b-4e07-9537-94eaa20e0958',
            name: 'Logic & Reasoning',
        },
        {
            id: '1a99684a-ff8c-44f4-9793-de96cd4ce0a4',
            name: 'Memory',
        },
        {
            id: 'e754e22c-fd2a-43f3-a4ec-1904848f9bd6',
            name: 'Personal Development',
        },
    ]

    public async run() {
        for (const systemSubcategory of this.SYSTEM_SUBCATEGORIES) {
            const subcategoryAttributes = {
                id: systemSubcategory.id,
                name: systemSubcategory.name,
                system: true,
                status: Status.ACTIVE,
            }

            // eslint-disable-next-line no-await-in-loop
            await Subcategory.createQueryBuilder()
                .insert()
                .into(Subcategory)
                .values(subcategoryAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'status'],
                })
                .execute()
        }
    }
}

export default new SubcategoriesInitializer()
