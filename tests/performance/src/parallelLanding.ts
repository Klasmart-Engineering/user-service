import landing from './scripts/landingV2';
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
                    duration: '2m',
                    target: 4
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
                    target: 5
                },
                // Hold
                {
                    duration: '2m',
                    target: 4
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
                    duration: '2m',
                    target: 4
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
                    duration: '2m',
                    target: 4
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher05: {
            executor: 'ramping-vus',
            exec: 'teacher05',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher06: {
            executor: 'ramping-vus',
            exec: 'teacher06',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher07: {
            executor: 'ramping-vus',
            exec: 'teacher07',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher08: {
            executor: 'ramping-vus',
            exec: 'teacher08',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        teacher09: {
            executor: 'ramping-vus',
            exec: 'teacher09',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students00: {
            executor: 'ramping-vus',
            exec: 'students00',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students01: {
            executor: 'ramping-vus',
            exec: 'students01',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up          
                {
                    duration: '20s',
                    target: 5
                },
                // Hold
                {
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 1
                },
            ],
        },
        students02: {
            executor: 'ramping-vus',
            exec: 'students02',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students03: {
            executor: 'ramping-vus',
            exec: 'students03',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students04: {
            executor: 'ramping-vus',
            exec: 'students04',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students05: {
            executor: 'ramping-vus',
            exec: 'students05',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students06: {
            executor: 'ramping-vus',
            exec: 'students06',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students07: {
            executor: 'ramping-vus',
            exec: 'students07',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students08: {
            executor: 'ramping-vus',
            exec: 'students08',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students09: {
            executor: 'ramping-vus',
            exec: 'students09',
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
                    duration: '2m',
                    target: 4
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        students10: {
            executor: 'ramping-vus',
            exec: 'students10',
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
                    duration: '2m',
                    target: 4
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
    const l = 10;
    let data = {};

    for (i; i < 10; i++) {
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
export function teacher05(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher05);
}
export function teacher06(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher06);
}
export function teacher07(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher07);
}
export function teacher08(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher08);
}
export function teacher09(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher09);
}
export function teacher10(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.teacher10);
}
export function students00(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students00);
}
export function students01(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students01);
}
export function students02(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students02);
}
export function students03(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students03);
}
export function students04(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students04);
}
export function students05(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students05);
}
export function students06(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students06);
}
export function students07(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students07);
}
export function students08(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students08);
}
export function students09(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students09);
}
export function students10(data: { [key: string]: { res: any, userId: string }}) {
    landing(data.students10);
}

