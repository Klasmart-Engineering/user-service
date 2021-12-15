import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminLogin2 from './scripts/userOrgAdminLogin2';

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminLogin2();
    sleep(1);
   
}