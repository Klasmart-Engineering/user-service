import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('endPointHomeRequest6');
const serverWaitingTime = new Trend('endPointHomeRequest6Waiting', true);
const errorCounter400 = new Counter('endPointHomeRequest6Error400');
const errorCounter500 = new Counter('endPointHomeRequest6Error500');

export default function (roleType?: string) {

    // const res = http.get(`${process.env.CMS_CONTENT_FOLDER_URL}?content_type=2&order_by=-create_at&org_id=${process.env.ORG_ID}&page=1&page_size=100&path=&publish_status=published` as string, params);
    let res = http.get(`${process.env.CMS_CONTENT_FOLDER_URL}?content_type=2&order_by=-create_at&org_id=${process.env.ORG_ID}&page=1&page_size=100&path=&publish_status=published` as string, params);

    if (res.status === 401) {
        http.get(`https://auth.${process.env.APP_URL}/refresh`, params);
        res = http.get(`${process.env.CMS_CONTENT_FOLDER_URL}?content_type=2&order_by=-create_at&org_id=${process.env.ORG_ID}&page=1&page_size=100&path=&publish_status=published` as string, params);
    }


    check(res, {
        'status is 200 meQueryReq6': () => res.status === 200,
        '"meQueryReq6" query returns data': (r) => JSON.parse(r.body as string).total !== undefined,

    }, {
        userRoleType: roleType
    });

    if (res.status >= 200 && res.status <= 299) {
        counter.add(1);
        
    } else if (res.status >= 400 && res.status <= 499) {
        errorCounter400.add(1);
    } else {
        errorCounter500.add(1);
    }

    serverWaitingTime.add(res.timings.waiting);
}
