import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { LoginPayload } from './interfaces/login';

const url = 'https://ams-auth.badanamu.net/v1/login';
const defaultPayload: LoginPayload = {
    deviceId: "webpage",
    deviceName: "k6",
    email: process.env.EMAIL_ORG_ADMIN_1 as string,
    pw: process.env.PW_ORG_ADMIN_1 as string,
};

const params = {
    headers: {
        'Content-Type': 'application/json',
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

    sleep(5);

    const authPayload = JSON.stringify(
        { token: token.accessToken }
    );
    
    const transferRes = http.post("https://auth.alpha.kidsloop.net/transfer", authPayload, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
    });

    if (
        ! check(transferRes, {
            'status is 200': (r) => r.status === 200,
        })
    ) {
        fail('failed to transfer user in login');
    }
}