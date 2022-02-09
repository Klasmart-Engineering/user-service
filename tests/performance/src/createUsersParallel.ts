import createUsersParallel from './scripts/createUsersParallel';
import { Options } from 'k6/options';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import http from 'k6/http';

export const options: Options = {
    scenarios: {
        orgAdmin1: {
            executor: 'per-vu-iterations',
            exec: 'createUsersAdmin1',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '5m',
        },
        orgAdmin2: {
            executor: 'per-vu-iterations',
            exec: 'createUsersAdmin2',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '5m',
        },
    }
}

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

    const orgAdminLoginPayload2 = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_2 as string,
        pw: process.env.PW as string,
    };
    
    const orgAdminLoginData2 = loginSetup(orgAdminLoginPayload2);

    data = { 
        ...data, 
        [`orgAdmin2`]: orgAdminLoginData2,
    };


    return data;
}

export function createUsersAdmin1(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    createUsersParallel(0, 9);
}

export function createUsersAdmin2(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin2.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin2.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    createUsersParallel(10, 19);
}
