import { check, sleep} from "k6";
import http from "k6/http";
import { CREATE_CLASS } from '../queries/classes';
import randomNumber from '../utils/randomNumber';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const schoolIds0 = [ 
    process.env.SCHOOL_ID_1,
    process.env.SCHOOL_ID_5, 
];

const schoolIds1 = [ 
    process.env.SCHOOL_ID_1, 
    process.env.SCHOOL_ID_2, 
    process.env.SCHOOL_ID_3, 
    process.env.SCHOOL_ID_4,
    process.env.SCHOOL_ID_5, 
];

const schoolIds2 = [ 
    process.env.SCHOOL_ID_1, 
    process.env.SCHOOL_ID_4,
    process.env.SCHOOL_ID_5, 
];

const schoolIds3 = [ 
    process.env.SCHOOL_ID_5, 
];

const schoolIds4 = [ 
    process.env.SCHOOL_ID_2, 
    process.env.SCHOOL_ID_3, 
    process.env.SCHOOL_ID_4,
    process.env.SCHOOL_ID_5, 
];

const schoolIds5 = [ 
    process.env.SCHOOL_ID_2, 
    process.env.SCHOOL_ID_3, 
    process.env.SCHOOL_ID_5, 
];

const schoolIdSets = [ 
    schoolIds0, 
    schoolIds1, 
    schoolIds2, 
    schoolIds3, 
    schoolIds4, 
    schoolIds5,
];

export default function(start: number, end: number) {
    let i = start;

    for(i; i <= end; i++) {
        const prefix = ('00' + i).slice(-3);

        const payload = JSON.stringify({
            operationName: 'organization',
            variables: {
                organization_id: process.env.ORG_ID,
                class_name: `test-sequence-${prefix}`,
                school_ids: schoolIdSets[randomNumber(5)],
            },
            query: CREATE_CLASS,
        });
    
        const res = http.post(process.env.SERVICE_URL as string, payload, params);
    
        check(res, {
            'create class status is 200': () => res.status === 200,
            'create class returns data': (r) => JSON.parse(r.body as string).data?.organization?.createClass.class_id ?? false,
        });
        sleep(0.1);
    }
};
