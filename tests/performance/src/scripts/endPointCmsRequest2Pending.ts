import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
  
    
    const res = http.get(`${process.env.CMS_CONTENT_PENDING_URL}?publish_status=pending&submenu=pending&content_type=1,2,10&order_by=-update_at&page=1&page_size=20&org_id=${process.env.ORG_ID}` as string, params);
    
    console.log(JSON.stringify(res))

    check(res, {
        'status is 200 endPointCmsRequest2Pending': () => res.status === 200,
        '"endPointCmsRequest2Pending" query returns data': (r) => JSON.parse(r.body as string).total !== undefined,

    }, {
        userRoleType: roleType
    });
}
