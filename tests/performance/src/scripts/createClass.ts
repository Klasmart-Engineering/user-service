import { check } from 'k6';
import http from 'k6/http';
import randomNumber from '../utils/randomNumber';
import { CREATE_CLASS } from '../queries/classes';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const payload = JSON.stringify({
        operationName: 'organization',
        variables: {
            organization_id: process.env.ORG_ID,
            class_name: `test-${randomNumber(999999999)}`,
            school_ids: [`ed74f70f-ff41-48ec-91f3-7d9e7dcea7a7`]
        },
        query: CREATE_CLASS,
    });

    const res = http.post(process.env.SERVICE_URL as string, payload, params);

    console.log(JSON.stringify(res));

    check(res, {
        'create class status is 200': () => res.status === 200,
        'create class returns data': (r) => JSON.parse(r.body as string).data?.organization?.createClass.class_id ?? false,
    });
}
