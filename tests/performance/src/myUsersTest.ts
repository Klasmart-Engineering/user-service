import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';


export const options:Options = {
    vus: 2,
    duration: `5s`,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const userPayload = JSON.stringify({
        variables: {},
        query: `query {
            my_users {
                user_id
                full_name
                given_name
                family_name
                email
                phone
                date_of_birth
                avatar
                username
            }
        }`,
    });

    const res = http.post(process.env.SERVICE_URL as string, userPayload, params);

    check(res, {
        'status is 200': () => res.status === 200,
        'my users query returns data': (r) => JSON.parse(r.body as string).data ?? false,
    });
}
