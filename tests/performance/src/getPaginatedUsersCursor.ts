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
                    target: 2
                },
                // Hold
                {
                    duration: '30s',
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
                    duration: '30s',
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
                    duration: '0s',
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

export function teacher00(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher00, null);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher01(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher01);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher02(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher02);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher03(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher03);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher04(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher04);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher05(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher05, null);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher06(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher06);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher07(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher07);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher08(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher08);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function teacher09(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.teacher09);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}

export function orgAdmin(data: { [key: string]: { res: any, userId: string }}) {
    let pageInfo = getUsers({ count: 10 }, data.orgAdmin);

    while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10 }, data.orgAdmin, null, pageInfo.endCursor);
    }
}