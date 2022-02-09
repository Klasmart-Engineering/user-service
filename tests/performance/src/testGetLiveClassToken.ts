import http from 'k6/http';
import generateClassPayload from './utils/generateClassPayload';
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import getLiveClassToken from './scripts/getLiveClassToken';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export function setup() {
    let data: { [key: string]: { res: any, userId: string }} = {};
    const orgAdminLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW as string,
    };
    
    const orgAdminLoginData = loginSetup(orgAdminLoginPayload);
    data = { 
        ...data, 
        [`orgAdmin`]: orgAdminLoginData,
    };

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    const payload = JSON.stringify(generateClassPayload());
    const classData = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, payload, params);

    data = {
        ...data,
        classId: JSON.parse(classData.body as string).data?.id,
    }

    return data;
}

export default function(data: { [key: string]: { res: any, userId: string } }) {
    if (!data.classId) {
        throw new Error('Class ID not setup' + JSON.stringify(data));
    }

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    getLiveClassToken(data.classId as unknown as string)
}