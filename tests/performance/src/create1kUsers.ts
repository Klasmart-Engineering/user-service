import { sleep } from "k6";
import { Options } from "k6/options";
import createUsersSequential from './scripts/createUsersSequential';
import switchUser from "./scripts/switchUser";
import testLogin from "./scripts/testLogin";

export const options:Options = {
    vus: 1,
};

export default function() {
    testLogin();
    switchUser();
    sleep(2);
    createUsersSequential(parseInt(__ENV.START, 10), parseInt(__ENV.END, 10));
}
