
import landingV2 from './scripts/landingV2';
import { Options } from 'k6/options';
import { sleep } from 'k6';
import landingSchedule from './scripts/landingSchedule';
import http from 'k6/http';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';

export const options: Options = {
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
    scenarios: {
        teachers01: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'teachers01',
        },
        teachers02: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'teachers02',
        },
        teachers03: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'teachers03',
        },
        teachers04: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'teachers04',
        },
    },
    setupTimeout: '5m',
};

export function teachers01() {
    const prefix = __VU + 15000;
    const teacherLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const teacherLoginData = loginSetup(teacherLoginPayload);
    console.log(`Logged in teacher: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', teacherLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', teacherLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(teacherLoginData);
    sleep(5);
    landingSchedule();
}

export function teachers02() {
    const prefix = __VU + 16000;
    const teacherLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const teacherLoginData = loginSetup(teacherLoginPayload);
    console.log(`Logged in teacher: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', teacherLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', teacherLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(teacherLoginData);
    sleep(5);
    landingSchedule();
}

export function teachers03() {
    const prefix = __VU + 16500;
    const teacherLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const teacherLoginData = loginSetup(teacherLoginPayload);
    console.log(`Logged in teacher: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', teacherLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', teacherLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(teacherLoginData);
    sleep(5);
    landingSchedule();
}

export function teachers04() {
    const prefix = __VU + 18000;
    const teacherLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const teacherLoginData = loginSetup(teacherLoginPayload);
    console.log(`Logged in teacher: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', teacherLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', teacherLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(teacherLoginData);
    sleep(5);
    landingSchedule();
}

