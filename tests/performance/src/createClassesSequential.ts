import { Options } from "k6/options";
import createClassesSequential from './scripts/createClassesSequential';
import loginSetup from './utils/loginSetup';

export const options:Options = {
    vus: 1,
};

export function setup() {
    let data = {};
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

    return data;
}

export default function() {
    createClassesSequential(parseInt(__ENV.START, 10), parseInt(__ENV.END, 10));
}
