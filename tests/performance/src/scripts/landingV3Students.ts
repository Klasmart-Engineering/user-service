import { sleep } from "k6";
import loginSetup from "../utils/loginSetup";
import endPointOrganizationRequest2 from "./endPointOrganizationRequest2";
import meQueryBasic from "./meQueryBasic";
import getMyUsers from "./getMyUsers";
import getMyUser from "./getMyUser";
import endPointOrganizationRequest5 from "./endPointOrganizationRequest5";
import endPointHomeRequest7AsStudent from "./endPointHomeRequest7AsStudent";
import getMeClassesStudying from "./getMeClassesStudying";
import schedulesTimeViewFullView from "./schedulesTimeViewFullView";
import endPointHomeRequest3 from "./endPointHomeRequest3";
import endPointHomeRequestAssementStudent from "./endPointHomeRequestAssessmentStudent";

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
    
    // Order 1
    // request #1 CMS service
    schedulesTimeViewFullView();

    // Order 2
    // request #1 USER service
    meQueryBasic();

    // Order 3
    // request #2 USER service
    endPointOrganizationRequest5();

    // Order 4
    // Request #3 - Singular - USER service
    getMyUser();    

    // Order 5
    // Request #4 User service
    endPointOrganizationRequest2();

    // Order 6
    // Request #5 User service - Plural
    getMyUsers();
    
    // Order 7
    // Request #2 CMS
    endPointHomeRequest3();

    // Order 8
    // Request #6 User service
    meQueryBasic(); 

    // Order 9
    // Request #7 User service
    endPointOrganizationRequest5();

    // Order 10
    // Request #8 User service
    getMeClassesStudying();

    // Order 11
    // Request #9 User service
    endPointHomeRequest7AsStudent(data.userId);

    // Order 12
    // Request #10 User service
    endPointOrganizationRequest2();

    // Order 13
    // Request #3 CMS
    endPointHomeRequestAssementStudent();
}