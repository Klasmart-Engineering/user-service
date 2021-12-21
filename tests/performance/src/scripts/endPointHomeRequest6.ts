import { check } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';
import { stringify } from 'uuid';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {

    const res = http.get(`${process.env.CMS_CONTENT_FOLDER_URL}?content_type=2&order_by=-create_at&org_id=${process.env.ORG_ID}&page=1&page_size=100&path=&publish_status=published` as string, params);
    

    check(res, {
        'status is 200 meQueryReq6': () => res.status === 200,

    }, {
        userRoleType: roleType
    });
}
