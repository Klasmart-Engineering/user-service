
import { Options } from 'k6/options';
import http from 'k6/http';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import landingV3Students from './scripts/landingV3Students';

// Command:
// k6 -e VUS=50 run parallelLandingHomeUnique.js
// to run the script be positioned in the folder ¨dist¨

// const prefixLimit: number = !isNaN(parseInt(__ENV.PREFIX_LIMIT, 10)) ? parseInt(__ENV.PREFIX_LIMIT) : 9;
const prefixLimit = 1000;

export const options: Options = {
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
   /*  thresholds: {
        http_req_failed: [{ threshold: 'rate<0.40', abortOnFail: true }],
        http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true }],
    }, */
    scenarios: {
        student01: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students01',
            duration: "10m",
        },
        student02: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students02',
            duration: "10m",
        },
        student03: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students03',
            duration: "10m",
        },
        student04: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students04',
            duration: "10m",
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

   // landingV2(studentLoginData);
   landingV3Students(studentLoginData);
    
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

    // landingV2(studentLoginData);
    landingV3Students(studentLoginData);
    
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
    
    // landingV2(studentLoginData);
    landingV3Students(studentLoginData);
   
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

    // landingV2(studentLoginData);
    landingV3Students(studentLoginData);
   
}

