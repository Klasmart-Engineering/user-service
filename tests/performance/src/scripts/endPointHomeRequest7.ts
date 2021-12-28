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
            id: process.env.ID_ORG_ADMIN_1,
            organizationId: process.env.ORG_ID
        },
        query: getUserNode
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    console.log(JSON.stringify(res))

    check(res, {
        'status is 200 meQueryReq7': () => res.status === 200,
        '"meQueryReq7" query returns data': (r) => JSON.parse(r.body as string).data?.userNode?.id ?? false,

    }, {
        userRoleType: roleType
    });
}