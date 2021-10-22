import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { getUserQuery } from '../queries/users';
import isUUID from '../utils/isUUID';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (userId: string) {
    const userPayload = JSON.stringify({
        variables: {
            user_id: userId,
        },
        operationName: "user",
        query: getUserQuery,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get user" status is 200': () => res.status === 200,
        '"Get user" query returns data': (r) => JSON.parse(r.body as string).data ?? false,
        ...isUUID(userId) ? { '"Get user" query returns no errors': (r) => !JSON.parse(r.body as string).errors?.length } : null
    });
}
