import testLogin from './testLogin';
import switchUser from './switchUser';
import meTest from './meTest';
import { sleep } from 'k6';
import { Options } from 'k6/options';
import { LoginPayload } from './interfaces/login';

export const options: Options = {
    scenarios: {
        orgAdmin: {
            executor: 'per-vu-iterations',
            exec: 'userOrgAdmin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '25s',
        },
        schoolAdmin: {
            executor: 'per-vu-iterations',
            exec: 'userSchoolAdmin',
            startTime: '30s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '25s',
        },
    }
}

export function userOrgAdmin() {
    testLogin();
    sleep(5);
    switchUser();
    sleep(5);
    meTest('Org admin');
}

export function userSchoolAdmin() {
    const loginPayload: LoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_SCHOOL_ADMIN_1 as string,
        pw: process.env.PW_SCHOOL_ADMIN_1 as string,
    };
    testLogin(loginPayload);
    sleep(5);
    switchUser();
    sleep(5);
    meTest('School admin');
}
