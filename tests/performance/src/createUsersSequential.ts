import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { createUserQuery } from './queries/users';
import { accountFormFiller } from './utils/accountFormFiller';

export const options: Options = {
    vus: 1,
    duration: `20s`,
    batch: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const accounts = accountFormFiller(3, 3);
    const payload = JSON.stringify({
        operationName: 'organizationInviteUser',
        variables: {},
        query: createUserQuery(accounts[0]),
    });
    
    const res = http.post(process.env.SERVICE_URL as string, payload, params);

    check(res, {
        'create user status is 200': () => res.status === 200,
        'create user returned newly created account': (r) => JSON.parse(r.body as string).data?.organization?.inviteUser.user?.user_id ?? false,
    });
}
