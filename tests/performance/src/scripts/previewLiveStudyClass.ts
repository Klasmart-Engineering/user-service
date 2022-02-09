import { check } from 'k6';
import http from 'k6/http';

export default function (classId: string) {
    const res = http.get(`https://cms.${process.env.APP_URL}/v1/schedules_view/${classId}?&org_id=${process.env.ORG_ID}` as string);

    check(res, {
        'STUDY - status is 200': (r) => r.status === 200,
        'STUDY - returned correct data': (r) => JSON.parse(r.body as string)?.id === classId
    });
}