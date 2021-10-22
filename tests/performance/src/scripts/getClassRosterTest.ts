import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import {getClassRoster } from '../queries/users';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (organizationId: string, classId: string) {
    const userPayload = JSON.stringify({
        variables: {
            class_id: classId,
            organization_id: organizationId,
        },
        operationName: "class",
        query: getClassRoster,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get class roster" status is 200': () => res.status === 200,
        '"Get class roster" query returns data': (r) => JSON.parse(r.body as string).data ?? false,
    });
}
