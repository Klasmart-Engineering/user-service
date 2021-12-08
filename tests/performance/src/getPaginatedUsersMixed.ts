import { Options } from "k6/options";
import loginSetup from "./utils/loginSetup";
import getUsers from "./scripts/getOrganizationUsers";
import { sleep } from "k6";

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
                    target: 4
                },
                // Hold
                {
                    duration: '3m',
                    target: 20
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
                    duration: '3m',
                    target: 25
                },
                // Ramp down
                {
                    duration: '20s',
                    target: 0
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
                    target: 6
                },
                // Hold
                {
                    duration: '3m',
                    target: 30
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
                    target: 5
                },
                // Hold
                {
                    duration: '3m',
                    target: 25
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
                    target: 4
                },
                // Hold
                {
                    duration: '2m',
                    target: 20
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
                    target: 6
                },
                // Hold
                {
                    duration: '3m',
                    target: 20
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
                    target: 5
                },
                // Hold
                {
                    duration: '3m',
                    target: 25
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
    }
}

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
            pw: process.env.PW_TEACHER_1 as string,
        };
        
        const teacherLoginData = loginSetup(teacherLoginPayload);
        data = { 
            ...data, 
            [`teacher${prefix}`]: teacherLoginData,
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

export function teacher00(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher00, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'active',
    }}]);

    sleep(5);

    getUsers({ count: 50, search: 'student' }, data.teacher00, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'active',
    }}]);
}

export function teacher01(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher01, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'inactive',
    }}]);
}

export function teacher02(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher02, [{ roleId: {
        operator: 'eq',
        value: process.env.ROLE_ID_STUDENT as string,
    }}]);
}

export function teacher03(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher03, [{ roleId: {
        operator: 'eq',
        value: process.env.ROLE_ID_STUDENT as string,
    }}]);
}

export function teacher04(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher04, [
        { 
            roleId: {
                operator: 'eq',
                value: process.env.ROLE_ID_STUDENT as string,
            },
            email: {
                operator: "contains", 
                value: "edgardo"
            }
        }
    ]);
}

export function teacher05(data: { [key: string]: { res: any, userId: string }}) {
   let pageInfo = getUsers({ count: 10, search: 'student'  }, data.teacher05, [{email: {operator: "contains", value: "edgardo"}}]);

   while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10, search: 'student'  }, data.teacher05, [{email: {operator: "contains", value: "edgardo"}}], pageInfo.endCursor);
    }
}

export function teacher06(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher06, [{schoolId: {operator: "eq", value: "7b11aaae-8e8b-4370-b8a7-6bb069088967"}}]);
 }

export function orgAdmin(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.orgAdmin, [{ roleId: {
        operator: 'eq',
        value: process.env.ROLE_ID_STUDENT as string,
    }}]);
}