import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    
    const res = http.get(`${process.env.CMS_CONTENT_FOLDER_URL}?publish_status=published&submenu=published&content_type=1%2C2%2C10&order_by=-update_at&page=1&page_size=20&path=&org_id=${process.env.ORG_ID}` as string, params);
    
    check(res, {
        'status is 200 endPointCmsRequest1': () => res.status === 200,
        '"endPointCmsRequest1" query returns data': (r) => JSON.parse(r.body as string).total !== undefined,

    }, {
        userRoleType: roleType
    });
}
