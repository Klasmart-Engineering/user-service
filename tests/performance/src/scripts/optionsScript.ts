import http from 'k6/http';
import { Options } from 'k6/options';

export const options:Options = {
    vus: 1,
};

const params = {
    headers: {
        accept: "*/*",
        "access-control-request-headers": "content-type",
        "access-control-request-method": "POST",
        origin: "https://auth.loadtest.kidsloop.live",
        "sec-fetch-mode": "cors",
    },
};

export default function () {
    http.options(
        "https://api.loadtest.kidsloop.live/user/",
        null,
        params
    );
}