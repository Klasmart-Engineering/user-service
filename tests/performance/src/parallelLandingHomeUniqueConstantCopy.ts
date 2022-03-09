
import landingV2 from './scripts/landingV2';
import { Options } from 'k6/options';
import { sleep } from 'k6';
import landingSchedule from './scripts/landingSchedule';
import http from 'k6/http';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import landingScheduleStudents from './scripts/landingScheduleStudents';
import landingV3Students from './scripts/landingV3Students';

// Command:
// k6 -e VUS=50 run parallelLandingScheduleUniqueConstantCopy.js
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
            duration: "30s",
        },
        student02: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students02',
            duration: "30s",
        },
        // student03: {
        //     executor: 'constant-vus',
        //     vus: parseInt(__ENV.VUS, 10),
        //     exec: 'students03',
        //     duration: "10m",
        // },
        // student04: {
        //     executor: 'constant-vus',
        //     vus: parseInt(__ENV.VUS, 10),
        //     exec: 'students04',
        //     duration: "10m",
        // },
    },
    setupTimeout: '10m',
};

//////////////////////

export function setup() {
    let i = 1;
    const l = (parseInt(__ENV.VUS, 10) * 4) + 1;
    let data = {};

    for (i; i < l; i++) {
        // const prefix = i < 1000 ? i : i < 2000 ? i + 2000 : i + 3000

        let studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.B2C_USERNAME}${i}@${process.env.B2C_DOMAIN}`,
            pw: process.env.B2C_PASSWORD as string,
        };

        const studentLoginData = loginSetup(studentLoginPayload);
        data = { 
            ...data, 
            [`student${i}`]: studentLoginData,
        };

        console.log(`Logged in student: ${process.env.B2C_USERNAME}${i}@${process.env.B2C_DOMAIN}`);

        studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.B2C_USERNAME}${2000 + i}@${process.env.B2C_DOMAIN}`,
            pw: process.env.B2C_PASSWORD as string,
        };
        data = { 
            ...data, 
            [`student${2000 + i}`]: studentLoginData,
        };

        console.log(`Logged in student: ${process.env.B2C_USERNAME}${2000 + i}@${process.env.B2C_DOMAIN}`);

        studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.B2C_USERNAME}${3000 + i}@${process.env.B2C_DOMAIN}`,
            pw: process.env.B2C_PASSWORD as string,
        };
        data = { 
            ...data, 
            [`student${3000 + i}`]: studentLoginData,
        };

        console.log(`Logged in student: ${process.env.B2C_USERNAME}${3000 + i}@${process.env.B2C_DOMAIN}`);
        //console.log(JSON.stringify(data));
    }

    console.log(JSON.stringify(data));
    
    return data;
};


/////////////////////

export function students01(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data[`student${__VU}`].res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data[`student${__VU}`].res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    // /* landingV2(studentLoginData);
    // sleep(5); 
    // landingSchedule();*/
    landingV3Students(data[`student${__VU}`]);
}

export function students02(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data[`student${__VU + 2000}`].res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data[`student${__VU + 2000}`].res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });


    landingV3Students(data[`student${__VU + 2000}`]);
}

/*
export function students03(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data[`student${__VU}`].res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data[`student${__VU}`].res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV3Students(data[`student${__VU}`]);
}

export function students04(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data[`student${__VU}`].res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data[`student${__VU}`].res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });


    landingV3Students(data[`student${__VU}`]);
}

*/