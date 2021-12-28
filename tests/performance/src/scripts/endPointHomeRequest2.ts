import { check } from 'k6';
import http from 'k6/http';
import {getUserQuery} from '../queries/users';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const userPayload = JSON.stringify({
        operationName: "user",
        variables: {
            user_id: '1c27b63a-9815-4719-bf64-cad3ab783adf',
        },
        query: getUserQuery //check if the query is it ok.
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200 meQueryReq2': () => res.status === 200,
        '"meQueryReq2" query returns data': (r) => JSON.parse(r.body as string).data?.user ?? false,

    }, {
        userRoleType: roleType
    });
}
