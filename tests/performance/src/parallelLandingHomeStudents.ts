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
            vus: 50,
            duration: '10m',
          },
 
          students01: {
            executor: 'constant-vus',
            exec: 'students01',
            vus: 50,
            duration: '10m',
          },

          students02: {
            executor: 'constant-vus',
            exec: 'students02',
            vus: 50,
            duration: '10m',
          },

          students03: {
            executor: 'constant-vus',
            exec: 'students03',
            vus: 50,
            duration: '10m',
          },

          students04: {
            executor: 'constant-vus',
            exec: 'students04',
            vus: 50,
            duration: '10m',
          },
          students05: {
            executor: 'constant-vus',
            exec: 'students05',
            vus: 50,
            duration: '10m',
          },
          students06: {
            executor: 'constant-vus',
            exec: 'students06',
            vus: 50,
            duration: '10m',
          },
          students07: {
            executor: 'constant-vus',
            exec: 'students07',
            vus: 50,
            duration: '10m',
          },
          students08: {
            executor: 'constant-vus',
            exec: 'students08',
            vus: 50,
            duration: '10m',
          },
          students09: {
            executor: 'constant-vus',
            exec: 'students09',
            vus: 50,
            duration: '10m',
          },
    },
};

export function setup() {
    let i = 0;
    const l = 10;
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
 

export function students05(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students05);
 }

export function students06(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students06.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students06.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV3Students(data.students06);
}

export function students07(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students07.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students07.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students07);
}
export function students08(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students08.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students08.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV3Students(data.students08);
}
export function students09(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students09.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students09.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV3Students(data.students09);
}
