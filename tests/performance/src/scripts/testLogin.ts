import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { LoginPayload } from '../interfaces/login';

const url = 'https://ams-auth.badanamu.net/v1/login';
const defaultPayload: LoginPayload = {
    deviceId: "webpage",
    deviceName: "k6",
    email: process.env.EMAIL_ORG_ADMIN_1 as string,
    pw: process.env.PW as string,
};

const params = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',

    },
};

export default function (loginPayload: LoginPayload = defaultPayload) {
    const payload = JSON.stringify(loginPayload);
    const res = http.post(url, payload, params);

    if (
        ! check(res, {
            'auth status is 200': (r) => r.status === 200,
        })
    ) {
        fail('failed to authenticate user in login');
    }

    const token = JSON.parse(res.body as string);


    sleep(1);

    const authPayload = JSON.stringify(
        { token: token.accessToken }
    );
    
    const transferRes = http.post(`${process.env.AUTH_URL}transfer` as string, authPayload, params);


    if (
        ! check(transferRes, {
            'status is 200': (r) => r.status === 200,
        })
    ) {
        fail('failed to transfer user in login');
    }
}