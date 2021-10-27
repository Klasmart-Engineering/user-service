import { sleep } from "k6";
import http from "k6/http";
import getClassRosterTest from "./getClassRosterTest";
import getUserTest from "./getUserTest";
import meTest from "./meTest";
import myUsersTest from "./myUsersTest";
import optionsScript from "./optionsScript";
import loginSetup from "../utils/loginSetup";

export function setup() {
    const loginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_TEACHER_1 as string,
        pw: process.env.PW_TEACHER_1 as string,
    };

    return loginSetup(loginPayload)
}   

export default function(data: { res: any, userId: string }) {
    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.res.cookies?.refresh[0].Value);

    meTest();
    sleep(1);
    meTest();
    sleep(1);
    meTest();
    sleep(1);
    meTest();
    sleep(1);
    optionsScript();
    sleep(1);
    meTest();
    optionsScript();
    getUserTest("");
    optionsScript();
    getClassRosterTest("", "");
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest();
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    meTest();
    optionsScript();
    myUsersTest();
    optionsScript();
    sleep(1);
    meTest();
    meTest();
    getUserTest(data.userId);
    getUserTest(data.userId);
    getUserTest(data.userId);
}
