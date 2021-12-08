import { check, sleep } from "k6";
import http from "k6/http";
import { isEmpty } from "lodash";
import { organization } from "../queries/schools";

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function(start: number, end: number) {
    let i = start;

    for(i; i <= end; i++) {
        const prefix = ('00' + i).slice(-3);


        const payload = JSON.stringify({
            operationName: 'organization',
            variables: {
                organization_id: '360b46fe-3579-42d4-9a39-dc48726d033f',
                school_name: `K6-1k-Schools-${prefix}`,
                shortcode:""

            },
            query: organization,
        });

        const res = http.post(process.env.SERVICE_URL as string, payload, params);

        check(res, {
            '"create school" status is 200': () => res.status === 200,
            //'"create shcool" returned newly created school': (r) => JSON.parse(r.body as string).data?.organization?.createSchool.shcool_id ?? false,
        });
        sleep(0.1);
    }
};