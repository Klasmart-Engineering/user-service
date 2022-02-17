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
        //const prefix = ('00' + i).slice(-3);
        const prefix = (i);

        const account = {
            alternate_email: "",
            alternate_phone: "",
            date_of_birth: "01-1990",
            email: `${process.env.EMAIL_USER_NAME_200K}${prefix}@${process.env.EMAIL_DOMAIN_200K}`,
            phone: "",
            family_name: `${prefix}`,
            gender: 'male',
            given_name: `LoadTest${prefix}`,
            organization_id: process.env.ORG_ID as string,
            organization_role_ids: [process.env.ROLE_ID_STUDENT as string],
            school_ids: [process.env.SCHOOL_ID_200K as string],
            school_role_ids: [],
            shortcode: "", 
        };

        const payload = JSON.stringify({
            operationName: 'organizationInviteUser',
            variables: {},
            query: createUserQuery(account),
        });

        const res = http.post(process.env.SERVICE_URL as string, payload, params);

        console.log(JSON.stringify(res));

        check(res, {
            '"create user" status is 200': () => res.status === 200,
            '"create user" returned newly created account': (r) => JSON.parse(r.body as string).data?.organization?.inviteUser?.user?.user_id ?? false,
        });
        sleep(0.2);
    }
};