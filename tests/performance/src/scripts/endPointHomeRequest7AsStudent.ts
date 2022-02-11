import { check } from 'k6';
import http from 'k6/http';
import { getUserNode } from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

/* const userPayload = JSON.stringify({
    operationName: "getUserNode",
    variables: {},
    query: getUserNode
}); */

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        operationName: "getUserNode",
        variables: {
            id: process.env.ID_STUDENT_00,
            organizationId: process.env.ORG_ID
        },
        query: getUserNode
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 meQueryReq7 STUDENT': () => res.status === 200,
        //'"meQueryReq7 STUDENT" query returns data': (r) => JSON.parse(r.body as string).data?.me !== undefined,

    }, {
        userRoleType: roleType
    });
}