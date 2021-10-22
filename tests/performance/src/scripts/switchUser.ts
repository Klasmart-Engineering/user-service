import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { myUsersQuery } from '../queries/users';

const params = {
    headers: {
        'Content-Type': 'application/json',
    },
};

export default function () {
    const userPayload = JSON.stringify({
        variables: {},
        query: myUsersQuery,
    });

    const resMyUsers = http.post(process.env.SERVICE_URL as string, userPayload, params);

    if (
        ! check(resMyUsers, {
            'status is 200': (r) => r.status === 200,
            'my users query returns data': (r) => JSON.parse(r.body as string).data?.my_users.length ?? false,
        })
    ) {
        fail('status code was *not* 200 in "my_users" query or query did not return any users');
    }

    sleep(5);

    const switchParams = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: `include`,
    }
    
    const myUsersData = JSON.parse(resMyUsers?.body as string);

    const switchPayload = JSON.stringify({
        user_id: myUsersData?.data.my_users[0].user_id,
    });

    const switchRes = http.post(`${process.env.AUTH_URL}switch`, switchPayload, switchParams);

    if (
        ! check(switchRes, {
            '"My users" status is 200': (r) => r.status === 200,
        })
    ) {
        fail('failed to switch user in login');
    }
}