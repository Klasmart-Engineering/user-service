import { sleep } from "k6";
import http from "k6/http";
import getUserTest from "./getUserTest";
import meTest from "./meTest";
import loginSetup from "../utils/loginSetup";
import endPointOrganizationRequest2 from "./endPointOrganizationRequest2";
import meQueryBasic from "./meQueryBasic";
import endPointHomeRequest7 from "./endPointHomeRequest7";

export function setup() {
    const loginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_TEACHER_1 as string,
        pw: process.env.PW as string,
    };

    return loginSetup(loginPayload)
}   

export default function(data: { res: any, userId: string }) {
    meTest(); // request #1
    sleep(1); 
    // meTest();
    // sleep(1);
    endPointOrganizationRequest2();
    sleep(0.5)
    endPointOrganizationRequest2();
    sleep(0.5)
    
    meQueryBasic();

    // ver las request 7 y 8
    // agregar request classesStudying
    sleep(0.5)
    meQueryBasic();
    sleep(0.5)
    endPointOrganizationRequest2();
    sleep(0.5)
    endPointHomeRequest7(),

    


    meTest();
    sleep(0.5)
    getUserTest(data.userId);
    sleep(1);
    meTest();
    sleep(0.5)
    getUserTest(data.userId);
    sleep(0.5)
    meTest();
}
