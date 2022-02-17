import ws from 'k6/ws';
import { check } from 'k6';
import { Params } from 'k6/http';
import { userAgent } from '../utils/common';

export default function (data: { refreshId: string, accessCookie: string, token: string, roomId: string }) {
	const url = process.env.WSS_URL as string;
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

	const res = ws.connect(url, params, (socket) => {
		socket.on('open', () => {
			socket.send(JSON.stringify({
				payload: {
					authToken: data.token,
					sessionId: process.env.MOCK_SESSION_ID,
				},
				type: 'connection_init'
			}));
		});

		socket.on('message', (data) => console.log('Message received: ', data));

		socket.setTimeout(function () {
			socket.close();
		}, 2000);

		socket.on('error', (e) => {
			if (e.error() != 'websocket: close sent') {
				console.log('An unexpected error occured: ', JSON.stringify(e));
			}
		});
	});

  	check(res, { 'status is 101': (r) => r && r.status === 101 });
}
