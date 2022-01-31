import landingV2 from './scripts/landingV2';
import { Options } from 'k6/options';
import { sleep } from 'k6';
import http from 'k6/http';
import { config } from './config/parallelLanding';
import loginSetup from './utils/uniqueUserCookies';
import generateStages from './utils/generateStages';

const stages: number = !isNaN(parseInt(__ENV.STAGE_QTY, 10)) ? parseInt(__ENV.STAGE_QTY) : 1;
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
        teacher00: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher01: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        teacher02: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student00: {
            executor: 'ramping-vus',
            exec: 'student00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student01: {
            executor: 'ramping-vus',
            exec: 'student01',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student02: {
            executor: 'ramping-vus',
            exec: 'student02',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student03: {
            executor: 'ramping-vus',
            exec: 'student03',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },/*
        student04: {
            executor: 'ramping-vus',
            exec: 'student04',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },/*
        student05: {
            executor: 'ramping-vus',
            exec: 'student05',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        }, 
        student06: {
            executor: 'ramping-vus',
            exec: 'student06',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        }, */
    }
};



export function setup() {
    return loginSetup();
}

export function teacher00(data: { [key: string]: { res: any, userId: string }}) { 
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher00);
    sleep(5);

}
export function teacher01(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher01.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher01.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher01);
    sleep(5);
}
export function teacher02(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher02.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher02.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher02);
    sleep(5);
}
/*
export function teacher03(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher03.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher03.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher03);
    sleep(5);
}
export function teacher04(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher04.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher04.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher04);
    sleep(5);
}
export function teacher05(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher05);
    sleep(5);
}
export function teacher06(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher06.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher06.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher06);
    sleep(5);
}
export function teacher07(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher07.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher07.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher07);
    sleep(5);
}
export function teacher08(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher08.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher08.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher08);
    sleep(5);
}
export function teacher09(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher09.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher09.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher09);
    sleep(5);
}
*/
export function student00(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student00);
    sleep(5);
}
export function student01(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student01.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student01.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student01);
    sleep(5);
}
export function student02(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student02.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student02.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student02);
    sleep(5);
}
export function student03(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student03.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student03.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student03);
    sleep(5);
}
export function student04(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student04.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student04.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student04);
    sleep(5);
}
/*
export function student05(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student05);
    sleep(5);
}
/*
export function student06(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student06.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student06.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.student06);
    sleep(5);
}
/*
export function student07(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student07.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student07.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student07);
    sleep(5);
}
export function student08(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student08.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student08.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.student08);
    sleep(5);
}
export function student09(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.student09.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.student09.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.student09);
    sleep(5);
}
*/