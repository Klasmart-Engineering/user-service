import userOrgAdminLogin from './scripts/userOrgAdminLogin';
import { sleep } from 'k6';
import { Options } from 'k6/options';

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminLogin();
    sleep(1);
   
}