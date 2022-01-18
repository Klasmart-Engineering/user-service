import { Options } from 'k6/options';
import schedulesTimeView from './scripts/schedulesTimeView';
import randomCookieSetup from './utils/randomCookieSetup';
import loginSetup from './utils/uniqueUserCookies';

export const options: Options = {
    vus: __ENV.VUS ? parseInt(__ENV.VUS, 10) : 1,
    duration: __ENV.DURATION ?? '20s',
};

export function setup() {
   return loginSetup();
}

export default function(data: { [key: string]: { res: any, userId: string }}) {
    randomCookieSetup(data);    
    schedulesTimeView();
}