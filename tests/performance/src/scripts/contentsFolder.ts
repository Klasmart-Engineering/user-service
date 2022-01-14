import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const path = `publish_status=published&submenu=published&content_type=1%2C2%2C10&order_by=-update_at&page=1&page_size=20&path=&org_id=${process.env.ORG_ID}`;
    const res = http.get(`${process.env.CMS_URL}/v1/contents_folders?${path.replace(`\n`, '')}`, params);

    check(res, {
        '"meMembership" status is 200': () => res.status === 200,
        '"meMembership" returned valid data': (r) => JSON.parse(r.body as string).list ?? false,
    });
}
