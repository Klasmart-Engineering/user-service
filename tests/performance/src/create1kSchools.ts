import { sleep } from "k6";
import { Options } from "k6/options";
import createSchooldSequential from './scripts/createSchooldSequential';
import switchUser from "./scripts/switchUser";
import testLogin from "./scripts/testLogin";

export const options:Options = {
    vus: 1,
};

export default function() {
    testLogin();
    switchUser();
    sleep(2);
    createSchooldSequential(21, 100); // add 12 schools more
}
