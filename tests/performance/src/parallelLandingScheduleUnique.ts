
import landingV2 from './scripts/landingV2';
import { Options } from 'k6/options';
import { sleep } from 'k6';
import landingSchedule from './scripts/landingSchedule';
import http from 'k6/http';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';

// const prefixLimit: number = !isNaN(parseInt(__ENV.PREFIX_LIMIT, 10)) ? parseInt(__ENV.PREFIX_LIMIT) : 9;
const prefixLimit = 1000;

export const options: Options = {
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
    thresholds: {
        http_req_failed: [{ threshold: 'rate<0.40', abortOnFail: true }],
        http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true }],
    },
    scenarios: {
        student01: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students01',
        },
        student02: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students02',
        },
        student03: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students03',
        },
        student04: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students04',
        },
    },
    setupTimeout: '5m',
};

export function students01() {
    const prefix = __VU;
    const studentLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const studentLoginData = loginSetup(studentLoginPayload);
    console.log(`Logged in student: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', studentLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', studentLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(studentLoginData);
    sleep(5);
    landingSchedule();
}

export function students02() {
    const prefix = __VU + 1000;
    const studentLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const studentLoginData = loginSetup(studentLoginPayload);
    console.log(`Logged in student: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', studentLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', studentLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(studentLoginData);
    sleep(5);
    landingSchedule();
}

export function students03() {
    const prefix = __VU + 2000;
    const studentLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const studentLoginData = loginSetup(studentLoginPayload);
    console.log(`Logged in student: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', studentLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', studentLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(studentLoginData);
    sleep(5);
    landingSchedule();
}

export function students04() {
    const prefix = __VU + 3000;
    const studentLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const studentLoginData = loginSetup(studentLoginPayload);
    console.log(`Logged in student: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', studentLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', studentLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(studentLoginData);
    sleep(5);
    landingSchedule();
}

