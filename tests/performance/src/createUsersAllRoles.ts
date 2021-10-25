import { sleep } from "k6";
import { Options } from "k6/options";
import createSingleUser from "./scripts/createSingleUser";
import getOrganizationUsers from "./scripts/getOrganizationUsers";
import optionsScript from "./scripts/optionsScript";
import switchUser from "./scripts/switchUser";
import testLogin from "./scripts/testLogin";

export const options:Options = {
    vus: 1,
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(100)<200'],
      },
};

export default function() {
    const roles = [
        process.env.ROLE_ID_ORG_ADMIN,
        process.env.ROLE_ID_SCHOOL_ADMIN,
        process.env.ROLE_ID_TEACHER,
        process.env.ROLE_ID_STUDENT,
        process.env.ROLE_ID_PARENT,
    ];

    for (const role in roles) {
        testLogin();
        switchUser();
        sleep(2);
        createSingleUser(role as string);
        optionsScript();
        sleep(2.5);
        getOrganizationUsers();
        sleep(1);
    }
}
