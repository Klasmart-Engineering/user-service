import { check, sleep } from "k6";
import http from "k6/http";
import { createUserQuery } from "../queries/users";
import getOrganizationUsers from "./getOrganizationUsers";
import optionsScript from "./optionsScript";

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const getRole = (i: number, total: number) => {
    const selector = (i / total) * 10;
    const role = selector < 4 ?
        process.env.ROLE_ID_STUDENT : selector >= 4 && selector < 6 ?
        process.env.ROLE_ID_TEACHER : selector >= 6 && selector < 8 ?
        process.env.ROLE_ID_PARENT : process.env.ROLE_ID_SCHOOL_ADMIN;

    return role;
};

export default function(start: number, end: number) {
    let i = start;

    for(i; i <= end; i++) {
        const prefix = ('00' + i).slice(-3);
        const role = getRole(i, end - start + 1);

        const account = {
            alternate_email: "",
            alternate_phone: "",
            date_of_birth: "01-1990",
            email: `${process.env.EMAIL_USER_NAME_1K}+k8+user_test_parallel-_${prefix}@${process.env.EMAIL_DOMAIN}`,
            phone: "",
            family_name: `K6-Parallel-${prefix}`,
            gender: 'male',
            given_name: `Test-parralel-${prefix}`,
            organization_id: process.env.ORG_ID as string,
            organization_role_ids: [role as string],
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
            '"create user - parallel" status is 200': () => res.status === 200,
            '"create user - parallel" returned newly created account': (r) => JSON.parse(r.body as string).data?.organization?.inviteUser?.user?.user_id ?? false,
        });
        optionsScript();
        sleep(1);
        getOrganizationUsers({ count: 10 });
        sleep(1);
    }
};
