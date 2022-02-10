import { sleep } from "k6";
import http from "k6/http";
import getUserTest from "./getUserTest";
import meTest from "./meTest";
import loginSetup from "../utils/loginSetup";
import endPointOrganizationRequest2 from "./endPointOrganizationRequest2";
import meQueryBasic from "./meQueryBasic";
import getMyUsers from "./getMyUsers";
import getMyUser from "./getMyUser";
import endPointOrganizationRequest5 from "./endPointOrganizationRequest5";
import endPointHomeRequest7AsStudent from "./endPointHomeRequest7AsStudent";
import getMeClassesStudying from "./getMeClassesStudying";


// This function is for Students that lands on the HOMEPAGE section.
// Emulates the request that are made from the FE side.

export function setup() {
    const loginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.STUDENT00_USERNAME as string,
        pw: process.env.PW as string,
    };

    return loginSetup(loginPayload)
}   

export default function(data: { res: any, userId: string }) {
    // request #1 USER service
    meQueryBasic();
    sleep(2);
    // request #2 USER service
    endPointOrganizationRequest5();
    sleep(2);

    // Request #3
    getMyUser();
    sleep(2);

    // Request #4 User service
    endPointOrganizationRequest2();
    sleep(2);

    // Request #5 User service
    getMyUsers();
    sleep(2);

    // Request #6 User service
    meQueryBasic(); 
    sleep(2);

    // Request #7 User service
    endPointOrganizationRequest5();
    sleep(2);

    // Request #8 User service
    getMeClassesStudying();
    sleep(2);

    // Request #9 User service
    endPointHomeRequest7AsStudent(data.userId);
    sleep(2);

    // Request #10 User service
    endPointOrganizationRequest2();
}