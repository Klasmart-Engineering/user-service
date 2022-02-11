import { Options } from 'k6/options';
import http from 'k6/http';
import { config } from './config/parallelLanding';
import loginSetup from './utils/loginSetup';
import landingV3Students from './scripts/landingV3Students';

/*
export const options: Options = {
    
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },

    /* scenarios: {
        students00: {
            executor: 'ramping-vus',
            exec: 'students00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '40s',
                    target: ß
                },
                // Hold
                {
                    duration: '10m',
                    target: 100
                },
                // Ramp down
                {
                    duration: '1m',
                    target: 0
                },
            ],
        },
        students01: {
            executor: 'ramping-vus',
            exec: 'students01',
            startTime: '5s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '40s',
                    target: 10
                },
                // Hold
                {
                    duration: '10m',
                    target: 100
                },
                // Ramp down
                {
                    duration: '1m',
                    target: 0
                },
            ],
        },
        students02: {
            executor: 'ramping-vus',
            exec: 'students02',
            startTime: '10s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '40s',
                    target: 10
                },
                // Hold
                {
                    duration: '10m',
                    target: 100
                },
                // Ramp down
                {
                    duration: '1m',
                    target: 0
                },
            ],
        },
        students03: {
            executor: 'ramping-vus',
            exec: 'students03',
            startTime: '13s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '40s',
                    target: 10
                },
                // Hold
                {
                    duration: '10m',
                    target: 100
                },
                // Ramp down
                {
                    duration: '1m',
                    target: 0
                },
            ],
        },
        students04: {
            executor: 'ramping-vus',
            exec: 'students04',
            startTime: '15s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '40s',
                    target: 1
                },
                // Hold
                {
                    duration: '10m',
                    target: 100
                },
                // Ramp down
                {
                    duration: '1m',
                    target: 0
                },
            ],
        }, */
        /* students05: {
            executor: 'ramping-vus',
            exec: 'students05',
            startTime: '17s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '40s',
                    target: 2
                },
                // Hold
                {
                    duration: '10m',
                    target: 100
                },
                // Ramp down
                {
                    duration: '1m',
                    target: 0
                },
            ],
        },
        
    }
    
};

*/

export const options: Options = {
    
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },

    scenarios:{
        students00: {
            executor: 'constant-vus',
            exec: 'students00',
            vus: 100,
            duration: '10m',
          },
 
          students01: {
            executor: 'constant-vus',
            exec: 'students01',
            vus: 100,
            duration: '10m',
          },

          students02: {
            executor: 'constant-vus',
            exec: 'students02',
            vus: 100,
            duration: '10m',
          },

          students03: {
            executor: 'constant-vus',
            exec: 'students03',
            vus: 100,
            duration: '10m',
          },

          students04: {
            executor: 'constant-vus',
            exec: 'students04',
            vus: 100,
            duration: '10m',
          },
    },
};

export function setup() {
    let i = 0;
    const l = 9;
    let data = {};

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW as string,
        };
        
        const studentLoginData = loginSetup(studentLoginPayload);
        data = { 
            ...data, 
            [`students${prefix}`]: studentLoginData,
        };
    }

    return data;
};

export function students00(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students00);
    
}


export function students01(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students01.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students01.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students01);
    
}

export function students02(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students02.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students02.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students02);
  
}
export function students03(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students03.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students03.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students03);
  
} 

export function students04(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students04.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students04.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students04);
}
 
/*
export function students05(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.students05);
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