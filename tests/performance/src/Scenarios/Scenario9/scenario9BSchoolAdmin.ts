import { Options } from "k6/options";
import loginSetup from "../../utils/loginSetup";
import getUsers from "../../scripts/getOrganizationUsers";
import { sleep } from "k6";

/* 
Link URL= https://calmisland.atlassian.net/wiki/spaces/BTS/pages/edit-v2/2398781836
    - See: Scenario 9 - b - As a School Admin → lands on Users & search users by "Given Name" and "Family Name"
    - Ticket: UD-1651 

This is scenario consist of:
    Create script that simulates a teacher using the search functionality by:
    - Given Name
    - Family Name
        - Accounts: 5 uniques account
*/

/* 
- Run with a max of VUs = 350
    - The number of users starts at 0, and slowly ramps up to the nominal value (20 secs-115 max), 
        where it stays for an extended period of time (3m). Then a ramp downstage goes to 0 in 20 secs.
    - Stage 1-  ramps up: duration: '20s' - target: 5 
    - Stage 2 - keep the load : duration: '2m' - target: 50
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
                    target: 50
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
                    target: 50
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
                    target: 50
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
                    target: 50
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
                    target: 50
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
                },
            ],
        },
        orgAdmin: {
            executor: 'ramping-vus',
            exec: 'orgAdmin',
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
    }
}

export function setup() {
    let i = 0;
    const l = 4;
    let data = {};

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const schoolAdmLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.SCHOOLADMIN_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_SCHOOL_ADMIN_1 as string,
        };
        
        const schoolAdmLoginData = loginSetup(schoolAdmLoginPayload);
        data = { 
            ...data, 
            [`schooladm${prefix}`]: schoolAdmLoginData,
        };
    }

    const orgAdminLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW_ORG_ADMIN_1 as string,
    };
    
    const orgAdminLoginData = loginSetup(orgAdminLoginPayload);
    data = { 
        ...data, 
        [`orgAdmin`]: orgAdminLoginData,
    };    

    return data;
}

/* Filter options
{organizationUserStatus: {operator: "eq", value: "inactive"}}
{roleId: { operator: 'eq', value: process.env.ROLE_ID_STUDENT, }}
{schoolId: {operator: "eq", value: "7b11aaae-8e8b-4370-b8a7-6bb069088967"}}
{email: {operator: "contains", value: "edgardo"}}
*/

export function school00(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.school00);
    sleep(5);
    getUsers({ count: 10, search: 'test' }, data.school00);
    sleep(5);

    /* getUsers({ count: 50, search: 'student' }, data.school00, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'active',
    }}]); */
}

export function school01(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.school01);
    sleep(5)
    getUsers({ count: 10, search: 'student' }, data.school01);
}

export function school02(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.school02);
}

export function school03(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.school03);
}

export function school04(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.school04);
}

export function school05(data: { [key: string]: { res: any, userId: string }}) {
   getUsers({ count: 10, search: 'student'  }, data.school05);

}

export function orgAdmin(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10 }, data.orgAdmin);
}