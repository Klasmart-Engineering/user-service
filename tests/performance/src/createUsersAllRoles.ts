import { sleep } from "k6";
import http from "k6/http";
import { Options } from "k6/options";
import createSingleUser from "./scripts/createSingleUser";
import getOrganizationUsers from "./scripts/getOrganizationUsers";
import optionsScript from "./scripts/optionsScript";
import loginSetup from './utils/loginSetup';

export const options:Options = {
    vus: 1,
    thresholds: {
        http_req_failed: ['rate<0.10'],
        http_req_duration: ['p(100)<500'],
      },
};

export function setup() {
    let data = {};
    const orgAdminLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW as string,
    };
    
    const orgAdminLoginData = loginSetup(orgAdminLoginPayload);
    data = { 
        ...data, 
        [`orgAdmin`]: orgAdminLoginData,
    };    

    return data;
}

export default function(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    const roles = [
        process.env.ROLE_ID_ORG_ADMIN,
        process.env.ROLE_ID_SCHOOL_ADMIN,
        process.env.ROLE_ID_TEACHER,
        process.env.ROLE_ID_STUDENT,
        process.env.ROLE_ID_PARENT,
    ];

    for (const i in roles) {
        createSingleUser(roles[i] as string);
        optionsScript();
        sleep(2.5);
        getOrganizationUsers({ count: 10 });
        sleep(1);
    }
}
