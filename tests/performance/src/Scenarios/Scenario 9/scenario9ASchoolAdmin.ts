import { Options } from "k6/options";
import loginSetup from "../../utils/loginSetup";
import getUsers from "../../scripts/getOrganizationUsers";

/* 
Link URL= https://calmisland.atlassian.net/wiki/spaces/BTS/pages/edit-v2/2398781836
    - See: Scenario 9 - As a School Admin → lands on Users
    - Ticket: UD-1650 

This is scenario consist of:
    - Create Script for Login multiple School Admin with unique accounts.
    - The script should emulate that each School Admin lands on the Home Page.
    - Then the School Admin can go to:
        - Users & set the page per row in 10
        - Accounts: 5 uniques account
*/

/* 
- Run with a max of VUs = 1050
    - The number of users starts at 0, and slowly ramps up to the nominal value (20 secs-115 max), 
        where it stays for an extended period of time (3m). Then a ramp downstage goes to 0 in 20 secs.
    - Stage 1-  ramps up: duration: '20s' - target: 5 
    - Stage 2 - keep the load : duration: '3m' - target: 50
    - Stage3 ramp downstage : duration: '20s' - target: 0
    -Total time:  2m45s
*/


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
                    target: 200
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
                    target: 5
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
                    target: 5
                },
                // Hold
                {
                    duration: '2m',
                    target: 200
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
                    target: 200
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
                    target: 5
                },
                // Hold
                {
                    duration: '2m',
                    target: 200
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
                    target: 200
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
            pw: process.env.PW as string,
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