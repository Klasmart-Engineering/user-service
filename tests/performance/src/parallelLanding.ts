import landing from './scripts/landing';
import { Options } from 'k6/options';
import loginSetup from './utils/loginSetup';

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
                    duration: '3m',
                    target: 2
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher01: {
            executor: 'ramping-vus',
            exec: 'teacher01',
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
                    duration: '3m',
                    target: 2
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 1
                },
            ],
        },
        teacher02: {
            executor: 'ramping-vus',
            exec: 'teacher02',
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
                    duration: '3m',
                    target: 2
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher03: {
            executor: 'ramping-vus',
            exec: 'teacher03',
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
                    duration: '3m',
                    target: 2
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher04: {
            executor: 'ramping-vus',
            exec: 'teacher04',
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
                    duration: '3m',
                    target: 2
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
    },
}

export function setup() {
    let i = 0;
    const l = 4;
    let data = {};

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const teacherLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.TEACHER_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_TEACHER_1 as string,
        };
        const studentLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.STUDENT_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_STUDENT_1 as string,
        };
        const teacherLoginData = loginSetup(teacherLoginPayload);
        const studentLoginData = loginSetup(studentLoginPayload);
        data = { 
            ...data, 
            [`teacher${prefix}`]: teacherLoginData,
            [`students${prefix}`]: studentLoginData
        };
    }

    return data;
}


export function teacher00(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher00);
}
 export function teacher01(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher01);
}
export function teacher02(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher02);
}
export function teacher03(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher03);
}
export function teacher04(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher04);
}