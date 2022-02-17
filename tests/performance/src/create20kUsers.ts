import { sleep } from "k6";
import { Options } from "k6/options";
import createUsersSequentialFor20k from './scripts/createUsersSequentialFor20k';
import switchUser from "./scripts/switchUser";
import testLogin from "./scripts/testLogin";

export const options:Options = {
    vus: 1,
};

export default function() {
    testLogin();
    switchUser();
    sleep(2);
    createUsersSequentialFor20k(parseInt(__ENV.START, 10), parseInt(__ENV.END, 10));
}
