import { check, sleep } from "k6";
import http from "k6/http";
import { createUserQuery } from "../queries/users";

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function(start: number, end: number) {
    let i = start;

    for(i; i <= end; i++) {
        const prefix = ('00' + i).slice(-3);

        const account = {
            alternate_email: "",
            alternate_phone: "",
            date_of_birth: "01-1990",
            email: `${process.env.EMAIL_USER_NAME_1K}+user_${prefix}@${process.env.EMAIL_DOMAIN}`,
            phone: "",
            family_name: `K6-${prefix}`,
            gender: 'male',
            given_name: `Test-${prefix}`,
            organization_id: process.env.ORG_ID as string,
            organization_role_ids: [process.env.ROLE_ID_STUDENT as string],
            school_ids: [],
            school_role_ids: [],
            shortcode: "",
        };

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
        sleep(0.1);
    }
};