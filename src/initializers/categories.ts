import { In } from 'typeorm'

import { Category } from '../entities/category'
import { Subcategory } from '../entities/subcategory'
import { Status } from '../entities/status'

export class CategoriesInitializer {
    SYSTEM_CATEGORIES = [
        {
            id: '2d5ea951-836c-471e-996e-76823a992689',
            name: 'None Specified',
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
        {
            id: 'b8c76823-150d-4d83-861e-dce7d7bc4f6d',
            name: 'Speech & Language Skills',
            subcategories: [
                '8b955cbc-6808-49b2-adc0-5bec8b59f4fe',
                '2b6b5d54-0243-4c7e-917a-1627f107f198',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '0fd7d721-df1b-41eb-baa4-08ba4ac2b2e7',
                '3fca3a2b-97b6-4ec9-a5b1-1d0ef5f1b445',
                '9a9882f1-d890-461c-a710-ca37fb78ddf5',
            ],
        },
        {
            id: 'b4cd42b8-a09b-4f66-a03a-b9f6b6f69895',
            name: 'Fine Motor Skills',
            subcategories: [
                '963729a4-7853-49d2-b75d-2c61d291afee',
                'bf89c192-93dd-4192-97ab-f37198548ead',
            ],
        },
        {
            id: 'bcfd9d76-cf05-4ccd-9a41-6b886da661be',
            name: 'Gross Motor Skills',
            subcategories: [
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
            ],
        },
        {
            id: 'c909acad-0c52-4fd3-8427-3b1e90a730da',
            name: 'Cognitive Skills',
            subcategories: [
                'f385c1ec-6cfa-4f49-a219-fd28374cf2a6',
                'b32321db-3b4a-4b1e-8db9-c485d045bf01',
            ],
        },
        {
            id: 'fa8ff09d-9062-4955-9b20-5fa20757f1d9',
            name: 'Personal Development',
            subcategories: [
                '824bb6cb-0169-4335-b7a5-6ece2b929da3',
                'ba77f705-9087-4424-bff9-50fcd0b1731e',
            ],
        },
        {
            id: '29a0ab9e-6364-47b6-b63a-1388a7861c6c',
            name: 'Oral Language',
            subcategories: [
                '843e4fea-7f4d-4746-87ff-693f5a44b467',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '5bb19c81-9261-428e-95ed-c87cc9f0560b',
                'b2cc7a69-4e64-4e97-9587-0078dccd845a',
            ],
        },
        {
            id: '49cbbf19-2ad7-4acb-b8c8-66531578116a',
            name: 'Literacy',
            subcategories: [
                '9b955fb9-8eda-4469-bd31-4e8f91192663',
                '644ba535-904c-4919-8b8c-688df2b6f7ee',
            ],
        },
        {
            id: 'bd55fd6b-73ef-41ed-8a86-d7bbc501e773',
            name: 'Whole-Child',
            subcategories: [
                '96f81756-70e3-41e5-9143-740376574e35',
                '0e6b1c2b-5e2f-47e1-8422-2a183f3e15c7',
                '144a3478-1946-4460-a965-0d7d74e63d65',
            ],
        },
        {
            id: 'dd3dbf0c-2872-433b-8b61-9ea78f3c9e97',
            name: 'Knowledge',
            subcategories: [
                '3b148168-31d0-4bef-9152-63c3ff516180',
                '49e73e4f-8ffc-47e3-9b87-0f9686d361d7',
                '9a52fb0a-6ce8-45df-92a0-f25b5d3d2344',
                '852c3495-1ced-4580-a584-9d475217f3d5',
                '4114f381-a7c5-4e88-be84-2bef4eb04ad0',
                'f4b07251-1d67-4a84-bcda-86c71cbf9cfd',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '5b405510-384a-4721-a526-e12b3cbf2092',
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '6fb79402-2fb6-4415-874c-338c949332ed',
            ],
        },
        {
            id: '2a637bea-c529-4868-8269-d0936696da7e',
            name: 'Language and Numeracy Skills',
            subcategories: [
                'c06b848d-8769-44e9-8dc7-929588cec0bc',
                '47169b0a-ac39-4e25-bd6e-77eecaf4e051',
                '55cbd434-36ce-4c57-b47e-d7119b578d7e',
                '8d49bbbb-b230-4d5a-900b-cde6283519a3',
                'a048cf91-2c96-4306-a7c2-cac2fe1d688a',
                'ddf87dff-1eb0-4971-9b27-2aaa534f34b1',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '01191172-b276-449f-ab11-8e66e990941e',
            ],
        },
        {
            id: '6933de3e-a568-4d56-8c01-e110bda22926',
            name: 'Fine Motor Skills',
            subcategories: [
                'a7850bd6-f5fd-4016-b708-7b823784ef0a',
                'bea9244e-ff17-47fc-8e7c-bceadf0f4f6e',
                'e2190c0c-918d-4a05-a045-6696ae31d5c4',
                '11351e3f-afc3-476e-b3af-a0c7718269ac',
                'd50cff7c-b0c7-43be-8ec7-877fa4c9a6fb',
                '7848bb23-2bb9-4108-938b-51f2f7d1d30f',
            ],
        },
        {
            id: '3af9f093-4153-4348-a097-986c15d1f912',
            name: 'Gross Motor Skills ',
            subcategories: [
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
                '9c30644b-0e9c-43aa-a19a-442e9f6aa6ae',
            ],
        },
        {
            id: 'a11a6f56-3ae3-4b70-8daa-30cdb63ef5b6',
            name: 'Cognitive',
            subcategories: [
                'ff838eb9-11b9-4de5-b854-a24d4d526f5e',
                'e45ff0ff-40a4-4be4-ab26-426aedba7597',
                '367c5e70-1487-4b33-96c0-529a37dbc5f2',
                '4ab80faf-60b9-4cc2-8f51-3d3b7f9fee13',
            ],
        },
        {
            id: '665616dd-32c2-44c4-91c9-63f7493c9fd3',
            name: 'Social and Emotional',
            subcategories: [
                '188c621a-cbc7-42e2-9d01-56f4847682cb',
                'b79735db-91c7-4bcb-860b-fe23902f81ea',
                '6ccc8306-1a9e-42bd-83ff-55bac3449853',
                'c79be603-ccf4-4284-9c8e-61b55ec53067',
            ],
        },
        {
            id: '64e000aa-4a2c-4e2e-9d8d-f779e97bdd73',
            name: 'Speech & Language Skills',
            subcategories: [
                '8b955cbc-6808-49b2-adc0-5bec8b59f4fe',
                '2b6b5d54-0243-4c7e-917a-1627f107f198',
                '0fd7d721-df1b-41eb-baa4-08ba4ac2b2e7',
                '3fca3a2b-97b6-4ec9-a5b1-1d0ef5f1b445',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '9a9882f1-d890-461c-a710-ca37fb78ddf5',
            ],
        },
        {
            id: '59c47920-4d0d-477c-a33b-06e7f13873d7',
            name: 'Fine Motor Skills',
            subcategories: [
                '963729a4-7853-49d2-b75d-2c61d291afee',
                'bf89c192-93dd-4192-97ab-f37198548ead',
            ],
        },
        {
            id: '7e887129-1e7d-40dc-8caa-5e1e0197fb4d',
            name: 'Gross Motor Skills',
            subcategories: [
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
            ],
        },
        {
            id: '9e35379a-c333-4471-937e-ac9eeb89cc77',
            name: 'Cognitive Skills',
            subcategories: [
                'f385c1ec-6cfa-4f49-a219-fd28374cf2a6',
                'b32321db-3b4a-4b1e-8db9-c485d045bf01',
            ],
        },
        {
            id: '5c75ab94-c4c8-43b6-a43b-b439f449a7fb',
            name: 'Personal Development',
            subcategories: [
                '824bb6cb-0169-4335-b7a5-6ece2b929da3',
                'ba77f705-9087-4424-bff9-50fcd0b1731e',
            ],
        },
        {
            id: 'ae82bafe-6513-4288-8951-18d93c07e3f1',
            name: 'Oral Language',
            subcategories: [
                '843e4fea-7f4d-4746-87ff-693f5a44b467',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                'b2cc7a69-4e64-4e97-9587-0078dccd845a',
            ],
        },
        {
            id: 'c68865b4-2ba3-4608-955c-dcc098291159',
            name: 'Literacy',
            subcategories: [
                'a7850bd6-f5fd-4016-b708-7b823784ef0a',
                '01191172-b276-449f-ab11-8e66e990941e',
            ],
        },
        {
            id: '61f517d8-2c2e-47fd-a2de-6e86465abc59',
            name: 'Whole-Child',
            subcategories: [
                '96f81756-70e3-41e5-9143-740376574e35',
                '0e6b1c2b-5e2f-47e1-8422-2a183f3e15c7',
                '144a3478-1946-4460-a965-0d7d74e63d65',
            ],
        },
        {
            id: '26e4aedc-2222-44e1-a375-388b138c695d',
            name: 'Knowledge',
            subcategories: [
                '3b148168-31d0-4bef-9152-63c3ff516180',
                '49e73e4f-8ffc-47e3-9b87-0f9686d361d7',
                '9a52fb0a-6ce8-45df-92a0-f25b5d3d2344',
                '852c3495-1ced-4580-a584-9d475217f3d5',
                '4114f381-a7c5-4e88-be84-2bef4eb04ad0',
                'f4b07251-1d67-4a84-bcda-86c71cbf9cfd',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '5b405510-384a-4721-a526-e12b3cbf2092',
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '6fb79402-2fb6-4415-874c-338c949332ed',
            ],
        },
        {
            id: 'bf1cd84d-da71-4111-82c6-e85224ab85ca',
            name: 'Speech & Language Skills',
            subcategories: [
                '8b955cbc-6808-49b2-adc0-5bec8b59f4fe',
                '2b6b5d54-0243-4c7e-917a-1627f107f198',
                '0fd7d721-df1b-41eb-baa4-08ba4ac2b2e7',
                '3fca3a2b-97b6-4ec9-a5b1-1d0ef5f1b445',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '9a9882f1-d890-461c-a710-ca37fb78ddf5',
            ],
        },
        {
            id: 'ba2db2b5-7f20-4cb7-88ef-cee0fcde7937',
            name: 'Fine Motor Skills',
            subcategories: [
                '963729a4-7853-49d2-b75d-2c61d291afee',
                'bf89c192-93dd-4192-97ab-f37198548ead',
            ],
        },
        {
            id: '07786ea3-ac7b-43e0-bb91-6cd813318185',
            name: 'Gross Motor Skills',
            subcategories: [
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
            ],
        },
        {
            id: 'c3f73955-26f0-49bf-91f7-8c42c81fb9d3',
            name: 'Cognitive Skills',
            subcategories: [
                'f385c1ec-6cfa-4f49-a219-fd28374cf2a6',
                'b32321db-3b4a-4b1e-8db9-c485d045bf01',
            ],
        },
        {
            id: 'aebc88cd-0673-487b-a194-06e3958670a4',
            name: 'Personal Development',
            subcategories: [
                '824bb6cb-0169-4335-b7a5-6ece2b929da3',
                'ba77f705-9087-4424-bff9-50fcd0b1731e',
            ],
        },
        {
            id: '22520430-b13e-43ba-930f-fd051bbbc42a',
            name: 'Oral Language',
            subcategories: [
                '843e4fea-7f4d-4746-87ff-693f5a44b467',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '5bb19c81-9261-428e-95ed-c87cc9f0560b',
                'b2cc7a69-4e64-4e97-9587-0078dccd845a',
            ],
        },
        {
            id: 'c3175001-2d1e-4b00-aacf-d188f4ae5cdf',
            name: 'Literacy',
            subcategories: [
                '9b955fb9-8eda-4469-bd31-4e8f91192663',
                '644ba535-904c-4919-8b8c-688df2b6f7ee',
            ],
        },
        {
            id: '19ac71c4-04e4-4d1c-8526-1acb292b7137',
            name: 'Whole-Child',
            subcategories: [
                '96f81756-70e3-41e5-9143-740376574e35',
                '0e6b1c2b-5e2f-47e1-8422-2a183f3e15c7',
                '144a3478-1946-4460-a965-0d7d74e63d65',
            ],
        },
        {
            id: 'd896bf1a-fb5b-4a57-b833-87b0959ba926',
            name: 'Knowledge',
            subcategories: [
                '3b148168-31d0-4bef-9152-63c3ff516180',
                '49e73e4f-8ffc-47e3-9b87-0f9686d361d7',
                '9a52fb0a-6ce8-45df-92a0-f25b5d3d2344',
                '852c3495-1ced-4580-a584-9d475217f3d5',
                '4114f381-a7c5-4e88-be84-2bef4eb04ad0',
                'f4b07251-1d67-4a84-bcda-86c71cbf9cfd',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '5b405510-384a-4721-a526-e12b3cbf2092',
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '6fb79402-2fb6-4415-874c-338c949332ed',
            ],
        },
        {
            id: 'fc06f364-98fe-487f-97fd-d2d6358dccc6',
            name: 'Speech & Language Skills',
            subcategories: [
                '8b955cbc-6808-49b2-adc0-5bec8b59f4fe',
                '2b6b5d54-0243-4c7e-917a-1627f107f198',
                '0fd7d721-df1b-41eb-baa4-08ba4ac2b2e7',
                '3fca3a2b-97b6-4ec9-a5b1-1d0ef5f1b445',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '9a9882f1-d890-461c-a710-ca37fb78ddf5',
            ],
        },
        {
            id: '0e66242a-4733-4970-a055-d0d6486f8674',
            name: 'Fine Motor Skills',
            subcategories: [
                '963729a4-7853-49d2-b75d-2c61d291afee',
                'bf89c192-93dd-4192-97ab-f37198548ead',
            ],
        },
        {
            id: 'e63956d9-3a36-40b3-a89d-bd45dc8c3181',
            name: 'Gross Motor Skills',
            subcategories: [
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
            ],
        },
        {
            id: 'b0b983e4-bf3c-4315-912e-67c8de4f9e11',
            name: 'Cognitive Skills',
            subcategories: [
                'f385c1ec-6cfa-4f49-a219-fd28374cf2a6',
                'b32321db-3b4a-4b1e-8db9-c485d045bf01',
            ],
        },
        {
            id: '84619bee-0b1f-447f-8208-4a39f32062c9',
            name: 'Personal Development',
            subcategories: [
                '824bb6cb-0169-4335-b7a5-6ece2b929da3',
                'ba77f705-9087-4424-bff9-50fcd0b1731e',
            ],
        },
        {
            id: '4b247e7e-dcf9-46a6-a477-a69635142d14',
            name: 'Oral Language',
            subcategories: [
                '843e4fea-7f4d-4746-87ff-693f5a44b467',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                'b2cc7a69-4e64-4e97-9587-0078dccd845a',
            ],
        },
        {
            id: '59565e03-8d8f-4475-a231-cfc551f004b5',
            name: 'Literacy',
            subcategories: [
                'a7850bd6-f5fd-4016-b708-7b823784ef0a',
                '39e96a23-5ac3-47c9-94fc-e71965f75880',
                '01191172-b276-449f-ab11-8e66e990941e',
            ],
        },
        {
            id: '880bc0fd-0209-4f72-999d-3103f9577edf',
            name: 'Whole-Child',
            subcategories: [
                '96f81756-70e3-41e5-9143-740376574e35',
                '0e6b1c2b-5e2f-47e1-8422-2a183f3e15c7',
                '144a3478-1946-4460-a965-0d7d74e63d65',
            ],
        },
        {
            id: 'bac3d444-6dcc-4d6c-a4d7-fb6c96fcfc72',
            name: 'Knowledge',
            subcategories: [
                '3b148168-31d0-4bef-9152-63c3ff516180',
                '49e73e4f-8ffc-47e3-9b87-0f9686d361d7',
                '9a52fb0a-6ce8-45df-92a0-f25b5d3d2344',
                '852c3495-1ced-4580-a584-9d475217f3d5',
                '4114f381-a7c5-4e88-be84-2bef4eb04ad0',
                'f4b07251-1d67-4a84-bcda-86c71cbf9cfd',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '5b405510-384a-4721-a526-e12b3cbf2092',
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '6fb79402-2fb6-4415-874c-338c949332ed',
            ],
        },
        {
            id: '6090e473-ec19-4bf0-ae5c-2d6a4c793f55',
            name: 'Speech & Language Skills',
            subcategories: [
                'a7850bd6-f5fd-4016-b708-7b823784ef0a',
                '8b955cbc-6808-49b2-adc0-5bec8b59f4fe',
                'c06b848d-8769-44e9-8dc7-929588cec0bc',
                'eb29827a-0053-4eee-83cd-8f4afb1b7cb4',
                '55cbd434-36ce-4c57-b47e-d7119b578d7e',
                'ddf87dff-1eb0-4971-9b27-2aaa534f34b1',
                '01191172-b276-449f-ab11-8e66e990941e',
            ],
        },
        {
            id: 'da9fa132-dcf7-4148-9037-b381850ba088',
            name: 'Fine Motor Skills',
            subcategories: [
                'a7850bd6-f5fd-4016-b708-7b823784ef0a',
                'bea9244e-ff17-47fc-8e7c-bceadf0f4f6e',
                'e2190c0c-918d-4a05-a045-6696ae31d5c4',
                '11351e3f-afc3-476e-b3af-a0c7718269ac',
                'd50cff7c-b0c7-43be-8ec7-877fa4c9a6fb',
                '7848bb23-2bb9-4108-938b-51f2f7d1d30f',
            ],
        },
        {
            id: '585f38e6-f7be-45f2-855a-f2a4bddca125',
            name: 'Gross Motor Skills',
            subcategories: [
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
            ],
        },
        {
            id: 'c3ea1b4a-d220-4248-9b3f-07559b415c56',
            name: 'Cognitive Skills',
            subcategories: [
                'b9d5a570-5be3-491b-9fdc-d26ea1c13847',
                '9a1e0589-0361-40e1-851c-b95b641e271e',
                '8d3f987a-7f7c-4035-a709-9526060b2177',
            ],
        },
        {
            id: '7826ff58-25d0-41f1-b38e-3e3a77ed32f6',
            name: 'Social and Emotional',
            subcategories: [
                '188c621a-cbc7-42e2-9d01-56f4847682cb',
                'b79735db-91c7-4bcb-860b-fe23902f81ea',
                '6ccc8306-1a9e-42bd-83ff-55bac3449853',
                'c79be603-ccf4-4284-9c8e-61b55ec53067',
            ],
        },
        {
            id: '1bb26398-3e38-441e-9a8a-460057f2d8c0',
            name: 'Speech & Language Skills',
            subcategories: [
                '8b955cbc-6808-49b2-adc0-5bec8b59f4fe',
                '2b6b5d54-0243-4c7e-917a-1627f107f198',
                '0fd7d721-df1b-41eb-baa4-08ba4ac2b2e7',
                '3fca3a2b-97b6-4ec9-a5b1-1d0ef5f1b445',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '9a9882f1-d890-461c-a710-ca37fb78ddf5',
            ],
        },
        {
            id: 'e65ea6b4-7093-490a-927e-d2235643f6ca',
            name: 'Fine Motor Skills',
            subcategories: [
                '963729a4-7853-49d2-b75d-2c61d291afee',
                'bf89c192-93dd-4192-97ab-f37198548ead',
            ],
        },
        {
            id: '88fff890-d614-4b88-be57-b7441fa40b66',
            name: 'Gross Motor Skills',
            subcategories: [
                'f78c01f9-4b8a-480c-8c4b-80d1ec1747a7',
                'f5a1e3a6-c0b1-4b2f-991f-9df7897dac67',
                'bd7adbd0-9ce7-4c50-aa8e-85b842683fb5',
            ],
        },
        {
            id: 'b18d60c6-a545-46ff-8988-cd5d46ab9660',
            name: 'Cognitive Skills',
            subcategories: [
                'f385c1ec-6cfa-4f49-a219-fd28374cf2a6',
                'b32321db-3b4a-4b1e-8db9-c485d045bf01',
            ],
        },
        {
            id: 'c83fd174-6504-4cc3-9175-2728d023c39d',
            name: 'Personal Development',
            subcategories: [
                '824bb6cb-0169-4335-b7a5-6ece2b929da3',
                'ba77f705-9087-4424-bff9-50fcd0b1731e',
            ],
        },
        {
            id: 'd17f1bee-cdef-4759-8c23-3e9b64d08ec1',
            name: 'Oral Language',
            subcategories: [
                '843e4fea-7f4d-4746-87ff-693f5a44b467',
                'ec1d6481-ab50-42b6-a4b5-1a5fb98796d0',
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                'b2cc7a69-4e64-4e97-9587-0078dccd845a',
            ],
        },
        {
            id: 'dd59f36d-717f-4982-9ae6-df32537faba0',
            name: 'Literacy',
            subcategories: [
                '9b955fb9-8eda-4469-bd31-4e8f91192663',
                '644ba535-904c-4919-8b8c-688df2b6f7ee',
            ],
        },
        {
            id: '8d464354-16d9-41af-b887-103f18f4b376',
            name: 'Whole-Child',
            subcategories: [
                '96f81756-70e3-41e5-9143-740376574e35',
                '0e6b1c2b-5e2f-47e1-8422-2a183f3e15c7',
                '144a3478-1946-4460-a965-0d7d74e63d65',
            ],
        },
        {
            id: 'dfed32b5-f0bd-42ea-999b-e10b376038d5',
            name: 'Knowledge',
            subcategories: [
                '3b148168-31d0-4bef-9152-63c3ff516180',
                '49e73e4f-8ffc-47e3-9b87-0f9686d361d7',
                '9a52fb0a-6ce8-45df-92a0-f25b5d3d2344',
                '852c3495-1ced-4580-a584-9d475217f3d5',
                '4114f381-a7c5-4e88-be84-2bef4eb04ad0',
                'f4b07251-1d67-4a84-bcda-86c71cbf9cfd',
                '81b09f61-4509-4ce0-b099-c208e62870f9',
                '5b405510-384a-4721-a526-e12b3cbf2092',
                'cd06e622-a323-40f3-8409-5384395e00d2',
                '6fb79402-2fb6-4415-874c-338c949332ed',
            ],
        },
        {
            id: '70d1dff5-4b5a-4029-98e8-8d9fd531b509',
            name: 'Science',
            subcategories: [
                '3e7c719b-aa3c-45c3-87ac-08ae0e6138b1',
                'b60f9fa0-a160-42e2-9cea-9ec39de2692a',
                '7dfc3b4c-3037-42f6-89be-75839e8ab40d',
                '60c8428a-98db-445f-9a91-fbddb20eb315',
                'db49ef2b-e680-488f-a241-dd5c0f0ee727',
                'eca38066-c702-4ca0-a1e7-420d8becf687',
                '92055ac9-45a8-4905-b713-e7b6473593f6',
                'b39b4fe4-2bc1-4d92-a8e3-ce163f6a3306',
                '00878904-73cc-4fb8-8ef6-9676cf89dd74',
                'fe0766c7-0c91-4652-b1fe-e949590cb9a2',
                'e601b3ef-5bcc-4dda-bf37-47244a63d067',
                '76cc0ed5-c00c-42f3-9e3b-7d1355e2d9c0',
            ],
        },
        {
            id: '196cbb34-5a44-4f26-9d91-64f321332ce9',
            name: 'Science',
            subcategories: [
                'cc15da82-113e-4652-be7d-2db162f55329', // Solids & Liquids
                'a98ffafa-974d-46e2-a30b-dcb721eb216b', // Properties
                '3b17c514-bd5a-4ed4-83d2-bc5691104035', // Temperature & Chemical Reactions
                '8cb19539-2a2d-4aca-a96c-73d21a7fc2f1', // Objects
                '4df4d746-3a03-49a6-a200-a4b7c1be0269', // Forces & Motion
                'dcafdd89-a94c-4ac4-af30-cd00a4f2f91b', // Types of Interactions
                'cfc086db-5f37-46a1-9739-6155e000da77', // Relationship Between Energy & Forces
                '3030e2d2-94fa-45ac-a913-ea35db665bb1', // Energy & Forces
                '23d55670-589a-4009-be2a-45405fa324e4', // Light
                'c08b9068-a67f-4de2-b1cb-f9caa9538000', // Sounds
                'f1d88809-3947-43ff-821a-c0451ce12906', // Sight
                'fb024485-c625-484b-9b6d-9425d41c07b9', // Information Technologies & Infrastructure
            ],
        },
        {
            id: '17e2dc7e-4911-4a73-9ff0-06baba99900f',
            name: 'Mathematics',
            subcategories: [
                '26654f67-ddc4-493d-9bc3-f260d8125d20',
                '485eb5a6-73a3-497e-8d19-51cd9c10b323',
                'c9dd0e2a-608c-4833-9bf6-b73d51dfd7eb',
                '4c523f7b-88ca-4e47-b0e3-27b66caf696b',
                'c5e36c28-2d3d-43e1-b35a-2cd9a60a30c9',
            ],
        },
        {
            id: '313305c7-bda4-4ca6-a787-e456dfc8ce81',
            name: 'Mathematics',
            subcategories: [
                '2f43fe7b-a5ec-446d-b197-45c99f88ee62', // Changing Sets
                '4f84b23f-0210-4644-a5b5-8b13fb01614c', // Comparing Sets
                'f681ea40-4b4f-4198-a52c-b7d5854dfe38', // Number Composition
                '317a73cf-931e-49f2-adf9-62b4de0ed375', // Pattern Regularity
                '51f09b4e-2b74-4ace-a056-cf97f85664cf', // Attributes
                '7ce95d05-ad4d-4bfc-b6be-901739a4bac0', // Comparison
                'b41ef932-8a75-4aee-b845-1a587f77dad9', // Precision
            ],
        },
        {
            id: '51ae3bca-0e55-465c-8302-6fdf132fa316',
            name: 'Cognitive',
            subcategories: [
                '8d3f987a-7f7c-4035-a709-9526060b2177',
                '9a1e0589-0361-40e1-851c-b95b641e271e',
                'b9d5a570-5be3-491b-9fdc-d26ea1c13847',
                '56ec83c8-39c7-462e-bd2b-365f2a7aae72',
            ],
        },
        {
            id: '1d3b076f-0968-4a06-bbaa-18cff13f3db8',
            name: 'Oral Language',
            subcategories: [
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd',
                '843e4fea-7f4d-4746-87ff-693f5a44b467',
            ],
        },
        {
            id: 'dafb0af8-877f-4af4-99b1-79d1a67de059',
            name: 'Whole Child',
            subcategories: [
                '5fff3596-42e9-416d-a2d2-29bc885fbb76',
                '144a3478-1946-4460-a965-0d7d74e63d65',
            ],
        },
        {
            id: '0f4810e7-5ce1-47e1-8aeb-43b73f15b007',
            name: 'Speech & Language Skills',
            subcategories: [
                'c06b848d-8769-44e9-8dc7-929588cec0bc', // Speaking
                'ddf87dff-1eb0-4971-9b27-2aaa534f34b1', // Listening
                '843e4fea-7f4d-4746-87ff-693f5a44b467', // Communication
                '38c17083-2ef7-402b-824a-20c38e3c57f4', // Phonological Awareness & Phonics
                '2d1152a3-fb03-4c4e-aeba-98856c3241bd', // Vocabulary
                '644ba535-904c-4919-8b8c-688df2b6f7ee', // Emergent Reading
                '9b955fb9-8eda-4469-bd31-4e8f91192663', // Emergent Writing
                'b2cc7a69-4e64-4e97-9587-0078dccd845a', // Language Support
            ],
        },
        {
            id: 'd5995392-11cb-4d28-a96d-8bdcd3f0436b',
            name: 'Fine Motor Skills',
            subcategories: [
                '7d3b5cb0-d9d2-42e8-b1f7-f58743edffdf', // Sensory Play
                'bf89c192-93dd-4192-97ab-f37198548ead', // Hand-Eye Coordination
                '8eb1ba6c-4bac-457c-a798-821ddafcedee', // Self-Care
                '223f3157-feb2-41ea-8c03-8a355b67343c', // Academic Skills
                '94a39407-035c-46e0-a039-357a33e9723a', // Learning Tools
            ],
        },
        {
            id: '94013867-72d1-44e2-a43d-7336818f35d0',
            name: 'Gross Motor Skills',
            subcategories: ['144a3478-1946-4460-a965-0d7d74e63d65'], // Physical Coordination
        },
        {
            id: '2b9d6317-298b-4aa5-9aea-aed56bd07823',
            name: 'Cognitive Skills',
            subcategories: [
                '6ff4c1af-252b-4e07-9537-94eaa20e0958', // Logic & Reasoning
                '1a99684a-ff8c-44f4-9793-de96cd4ce0a4', // Memory
                'f385c1ec-6cfa-4f49-a219-fd28374cf2a6', // Visual
            ],
        },
        {
            id: 'fc447234-af24-4768-b617-ac1b80ebae9b',
            name: 'Social & Emotional Skills',
            subcategories: ['e754e22c-fd2a-43f3-a4ec-1904848f9bd6'], // Personal Development
        },
        {
            id: 'd68c6c5d-c739-46d8-be70-e70d6c565949',
            name: 'Core Subjects',
            subcategories: [
                'cd06e622-a323-40f3-8409-5384395e00d2', // Science
                '6fb79402-2fb6-4415-874c-338c949332ed', // Art
                '49e73e4f-8ffc-47e3-9b87-0f9686d361d7', // Technology
                '81b09f61-4509-4ce0-b099-c208e62870f9', // Math
                '5b405510-384a-4721-a526-e12b3cbf2092', // Engineering
                'f4b07251-1d67-4a84-bcda-86c71cbf9cfd', // Social Studies
                '4114f381-a7c5-4e88-be84-2bef4eb04ad0', // Health
                '9a52fb0a-6ce8-45df-92a0-f25b5d3d2344', // Music
                '852c3495-1ced-4580-a584-9d475217f3d5', // Character Education
                '3b148168-31d0-4bef-9152-63c3ff516180', // Miscellaneous
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
                status: Status.ACTIVE,
            }

            await Category.createQueryBuilder()
                .insert()
                .into(Category)
                .values(categoryAttributes)
                .orUpdate({
                    conflict_target: ['id'],
                    overwrite: ['name', 'system', 'organization_id', 'status'],
                })
                .execute()

            const subcategories =
                (await Subcategory.find({
                    where: { id: In(systemCategory.subcategories) },
                })) || []

            const category = await Category.findOneByOrFail({
                id: systemCategory.id,
            })

            category.subcategories = Promise.resolve(subcategories)
            await category.save()
        }
    }
}

export default new CategoriesInitializer()
