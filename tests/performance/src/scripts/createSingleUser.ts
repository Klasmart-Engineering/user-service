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

export default function (roleId: string) {
    const random = randomNumber(1000000);
    const account = {
        alternate_email: "",
        alternate_phone: "",
        date_of_birth: "01-1990",
        email: `ismaelp+k6+${random}@bluetrailsoft.com`,
        phone: "",
        family_name: `K6-${random}`,
        gender: 'male',
        given_name: `Test`,
        organization_id: process.env.ORG_ID as string,
        organization_role_ids: [roleId],
        school_ids: [],
        school_role_ids: [],
        shortcode: "",
    }
    const payload = JSON.stringify({
        operationName: 'organizationInviteUser',
        variables: {},
        query: createUserQuery(account),
    });
    
    const res = http.post(process.env.SERVICE_URL as string, payload, params);

    check(res, {
        '"create user" status is 200': () => res.status === 200,
        '"create user" returned newly created account': (r) => JSON.parse(r.body as string).data?.organization?.inviteUser?.user?.user_id ?? false,
    });
}
