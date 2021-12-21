import http from 'k6/http';
import { Options } from 'k6/options';
import scheduleFilter from "./scripts/scheduleFilter";
import generateClassPayload from './utils/generateClassPayload';
import loginSetup from './utils/loginSetup';

export const options: Options = {
    scenarios: {
        orgAdmin1: {
            executor: 'per-vu-iterations',
            exec: 'orgAdmin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '30s',
        },
    }
};

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export function setup() {
    let data: { [key: string]: { res: any, userId: string }} = {};
    const orgAdminLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW_ORG_ADMIN_1 as string,
    };
    
    const orgAdminLoginData = loginSetup(orgAdminLoginPayload);
    data = { 
        ...data, 
        [`orgAdmin`]: orgAdminLoginData,
    };

    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value);

    jar.set(process.env.CMS_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value);
    jar.set(process.env.CMS_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value);

    const payload = JSON.stringify(generateClassPayload());
    http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, payload, params);

    return data;
}

export function orgAdmin(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value);

    jar.set(process.env.CMS_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value);
    jar.set(process.env.CMS_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value);
    scheduleFilter();
}