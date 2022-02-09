import ws from 'k6/ws';
import { check } from 'k6';
import { Params } from 'k6/http';
import { userAgent } from '../utils/common';

export default function (data: { refreshId: string, accessCookie: string, token: string, roomId: string }) {
	const url = "wss://live.loadtest.kidsloop.live/graphql";
	// const cookie = `locale=en; privacy=true; roomUserId=${data.roomId}:${data.refreshId}; access=${data.accessCookie}`;
	const params: Params = { 
		headers: {
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": "en-US,en;q=0.9,es;q=0.8",
			"Cache-Control": "no-cache",
			"Pragma": "no-cache",
			"user-agent": userAgent,
			"Sec-WebSocket-Protocol": "graphql-ws",
		},
		cookies: {
			locale: "en",
			privacy: "true",
			roomUserId: `${data.roomId}:${data.refreshId}; access=${data.accessCookie}`,
			access: data.accessCookie,
		}
	};

	console.log('params: ', JSON.stringify(params));

	const res = ws.connect(url, params, (socket) => {
		socket.on('open', () => {
			console.log('connected');
			console.log('sending token... ', data.token);
			socket.send(JSON.stringify({
				payload: {
					'live-authorization': data.token
				},
				type: 'connection_init'
			}));	

		});

		socket.on('message', (data) => console.log('Message received: ', data));

		socket.setTimeout(function () {
			socket.close();
		}, 5000);

		socket.on('error', (e) => {
			if (e.error() != 'websocket: close sent') {
				console.log('An unexpected error occured: ', JSON.stringify(e));
			}
		});
	});

	console.log('res: ', JSON.stringify(res));

  	check(res, { 'status is 101': (r) => r && r.status === 101 });
}

// Cookie: _ga=GA1.2.1801205734.1638471901;
// locale=en; privacy=true; _gid=GA1.2.302434672.1644336260; 
// roomUserId=620259f6cc63556dd4849b8e:7ccbecd2-5648-492f-a15f-4c8963ca291b;
// _gat_gtag_UA_149920485_3=1; 
// access=eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjdjY2JlY2QyLTU2NDgtNDkyZi1hMTVmLTRjODk2M2NhMjkxYiIsImVtYWlsIjoiZWRnYXJkb20razZfb3JnX2FkbWluQGJsdWV0cmFpbHNvZnQuY29tIiwiZXhwIjoxNjQ0MzYwMDQxLCJpc3MiOiJraWRzbG9vcCJ9.DMX_KAq4a0md_w5IWyqSffncY4MRrMbaZk6PwaxvTqjoYZVniG_LUKPsFCyjYp1r4og7x6OhJdY6Mny4nSagz61J6ibJb_ItxcBDLMYEs9e9CPtRNvuV8U_BhkuNEn7YO8HIBWdIYvZCSaSFnsBfVY98gHJX0FxGCk0Zh2vR2niUOeFcNB3lwdrOObsJgDSgWCELVHrcPWu-86ueGn7zJXEPXlubvblI89CYfh05tOXgM5gM325zG0Yz3lSIpIjRiY9zSj6sxR-2mrFgI2hLb--kcmmSRe0I9H0I3SjMuZ2d3DkCTVXW3uPqpkkaC89hTpsO5QKSAKsHBCI7zLhoUw