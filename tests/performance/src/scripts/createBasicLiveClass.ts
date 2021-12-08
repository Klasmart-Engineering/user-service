import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { createUserQuery } from '../queries/users';
import randomNumber from '../utils/randomNumber';

export const options: Options = {
    vus: 1,
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
   
    const payload = JSON.stringify({
        operationName: 'organizationInviteUser',
        variables: {},
        //query:,
    });
    
    const res = http.post(`${process.env.PUBLISHED_LEARNING_OUTCOMES}?org_id=${process.env.ORG_ID}` as string, payload, params);


    check(res, {
        '"create user" status is 200': () => res.status === 200,
        '"create user" returned newly created account': (r) => JSON.parse(r.body as string).data?.organization?.inviteUser?.user?.user_id ?? false,
    },
    {
        userRoleType: roleType
    });
}
