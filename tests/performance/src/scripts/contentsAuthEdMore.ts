import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};


export default function () {
    const path = `submenu=more+featured&program_group=More+Featured+Content&order_by=-update_at&page=1&page_size=20&org_id=${process.env.ORG_ID}`;
    const res = http.get(`${process.env.CMS_URL}/v1/contents_authed?${path.replace(`\n`, '')}`, params);

    check(res, {
        'more content status is 200': () => res.status === 200,
        'more content returned valid data': (r) => JSON.parse(r.body as string).list ?? false,
    });
}
