import http from 'k6/http';
import { Options } from 'k6/options';
import createStudyClass from "./scripts/createStudyClass";
import loginSetup from './utils/loginSetup';

// command k6 run studyClassPopulateBasic.js
// This script allows to create Study class as a Teacher role.

export const options: Options = {
    scenarios: {
        teacher00: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 2
                },
                // Hold
                {
                    duration: '15s',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
    }
    
};

export function setup() {
    let i = 0;
    const l = 9;
    let data = {};

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const teacherLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.TEACHER_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW as string,
        };
        
        const teacherLoginData = loginSetup(teacherLoginPayload);
        data = { 
            ...data, 
            [`teacher${prefix}`]: teacherLoginData,
        };
    }

    return data;
}

export function teacher00(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    createStudyClass();

}