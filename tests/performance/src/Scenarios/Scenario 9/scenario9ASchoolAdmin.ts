import { Options } from "k6/options";
import loginSetup from "../../utils/loginSetup";
import getUsers from "../../scripts/getOrganizationUsers";

export const options: Options = {
    scenarios: {
        school00: {
            executor: 'ramping-vus',
            exec: 'school00',
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
                    target: 300
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
         school01: {
            executor: 'ramping-vus',
            exec: 'school01',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 7
                },
                // Hold
                {
                    duration: '2m',
                    target: 50
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        school02: {
            executor: 'ramping-vus',
            exec: 'school02',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 8
                },
                // Hold
                {
                    duration: '2m',
                    target: 300
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        school03: {
            executor: 'ramping-vus',
            exec: 'school03',
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
                    target: 300
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        school04: {
            executor: 'ramping-vus',
            exec: 'school04',
            startTime: '0s',
            gracefulStop: '5s',
            stages: [
                // Ramp up               
                {
                    duration: '20s',
                    target: 7
                },
                // Hold
                {
                    duration: '2m',
                    target: 300
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        school05: {
            executor: 'ramping-vus',
            exec: 'school05',
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
                    target: 300
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        }, 
    }
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
            email: `${process.env.SCHOOLADMIN_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_SCHOOL_ADMIN_1 as string,
        };
        
        const teacherLoginData = loginSetup(teacherLoginPayload);
        data = { 
            ...data, 
            [`schooladm${prefix}`]: teacherLoginData,
        };
    }

    return data;
}

export function school00(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10 }, data.school00);
}

export function school01(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10 }, data.school01);
}

export function school02(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10 }, data.school02);
}

export function school03(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10 }, data.school03);
}

export function school04(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10 }, data.school04);
}

export function school05(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10 }, data.school05);
}