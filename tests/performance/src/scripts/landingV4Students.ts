import { sleep } from "k6";
import loginSetup from "../utils/loginSetup";
import endPointOrganizationRequest2 from "./endPointOrganizationRequest2";
import meQueryBasic from "./meQueryBasic";
import getMyUsers from "./getMyUsers";
import getMyUser from "./getMyUser";
import endPointOrganizationRequest5 from "./endPointOrganizationRequest5";
import endPointHomeRequest2forLandingV4 from "./endPointHomeRequest2forLandingV4";
import getMeClassesStudying from "./getMeClassesStudying";
import schedulesTimeViewFullView from "./schedulesTimeViewFullView";
import endPointHomeRequest3 from "./endPointHomeRequest3";
import endPointHomeRequestAssementStudent from "./endPointHomeRequestAssessmentStudent";
import { request } from "k6/http";
import endPointHomeRequest6 from "./endPointHomeRequest6";

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

//export default function(data: { res: any, userId: string })
export default function() {
    
    // Order 1
    // request #1 CMS service
    schedulesTimeViewFullView();

    // Order 2
    // request #1 USER service
    // meQueryBasic(); NO esta mas esta request

    // Order 3
    // request #2 USER service
    // endPointOrganizationRequest5(); NO esta mas esta request

    // Order 4 - DEBE ESTAR
    // Request #3 - Singular - USER service
    getMyUser();

    // Request 3 - USER service
    endPointHomeRequest2forLandingV4();

    // Order 5
    // Request #4 User service
    // endPointOrganizationRequest2(); NO esta mas esta request

    // Order 6
    // Request #5 User service - Plural
    // getMyUsers(); NO esta mas esta request
    
    // Order 7
    // Request #2 CMS
    // endPointHomeRequest3();

    // Order 8
    // Request #6 User service
    // meQueryBasic(); NO esta mas esta request

    // Order 9
    // Request #7 User service 
    // endPointOrganizationRequest5(); NO esta mas esta request

    // Order 10
    // Request #8 User service
    // getMeClassesStudying(); NO esta mas esta request

    // Order 11
    // Request #9 User service
    // endPointHomeRequest7AsStudent(data.userId); NO esta mas esta request - Hacer una similar a esta request, pero solo con variablie ORG_ID

    // Order 12
    // Request #10 User service
    // endPointOrganizationRequest2(); NO esta mas esta request

    // Order 13
    // Request #3 CMS
    endPointHomeRequestAssementStudent();

    // Added next call
    // CMS
    endPointHomeRequest6();
}