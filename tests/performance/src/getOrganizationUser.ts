import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { getOrganizationUserQuery } from './queries/users';

export const options:Options = {
    vus: 1,
    duration: `5s`,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const userPayload = JSON.stringify({
        variables: {
            organizationId: "",
            userId: "",
        },
        operationName: "getOrganizationUser",
        query: getOrganizationUserQuery,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        '"Get organization user" status is 200': () => res.status === 200,
        '"Get organization user" query returns data': (r) => JSON.parse(r.body as string).data?.user?.membership?.user_id ?? false,
    });
}
