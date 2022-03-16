import ws from 'k6/ws';
import { check } from 'k6';
import { Params } from 'k6/http';
import { userAgent } from '../utils/common';
import { Counter } from 'k6/metrics';

const counter = new Counter('WebSocketMessageSuccess');
const errorCounter = new Counter('WebSocketMessageError');


export default function (data: { refreshId: string, accessCookie: string, token: string, roomId: string, userId: string }) {
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

	const whiteboardEvents = JSON.stringify({
		id: 1,
		payload: {
			variables: {
				roomId: data.roomId
			}, 
			extensions: {}, 
			operationName: 'whiteboardEvents',
			query: 'subscription whiteboardEvents($roomId: ID!) {\n  whiteboardEvents(roomId: $roomId) {\n    type\n    id\n    generatedBy\n    objectType\n    param\n    __typename\n  }\n}\n',
			roomId: data.roomId,
		},
		type: 'start',
	});

	const whiteboardState = JSON.stringify({
		id: 2,
		payload: {
			extensions: {},
			operationName: 'whiteboardState',
			query: 'subscription whiteboardState($roomId: ID!) {\n  whiteboardState(roomId: $roomId) {\n    display\n    __typename\n  }\n}\n',
			variables: {
				roomId: data.roomId,
			},
			roomId: data.roomId,
		},
		type: 'start',
	});

	const whiteboardPermissions = JSON.stringify({
		id: 3,
		payload: {
			extensions: {},
			operationName: 'whiteboardPermissions',
			query: 'subscription whiteboardPermissions($roomId: ID!, $userId: ID!) {\n  whiteboardPermissions(roomId: $roomId, userId: $userId)\n}\n',
			variables: {
				roomId: data.roomId, 
				userId: data.userId,
			}
		},
		type: 'start'
	});

	const room = JSON.stringify({
		id: 4,
		payload: {
			extensions: {},
			operationName: 'room',
			query: 'subscription room($roomId: ID!, $name: String) {\n  room(roomId: $roomId, name: $name) {\n    message {\n      id\n      message\n      session {\n        name\n        isTeacher\n        __typename\n      }\n      __typename\n    }\n    content {\n      type\n      contentId\n      __typename\n    }\n    join {\n      id\n      name\n      streamId\n      isTeacher\n      isHost\n      joinedAt\n      __typename\n    }\n    leave {\n      id\n      __typename\n    }\n    session {\n      webRTC {\n        sessionId\n        description\n        ice\n        stream {\n          name\n          streamId\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    sfu\n    trophy {\n      from\n      user\n      kind\n      __typename\n    }\n    __typename\n  }\n}\n',
			variables: {
				roomId: data.roomId, 
				name: data.userId,
			},
		},
		type: 'start'
	});

	const studentUsage = JSON.stringify({
		id: 5,
		payload: {
			extensions: {},
			operationName: 'sendStudentUsageRecordEvent',
			query: 'mutation sendStudentUsageRecordEvent($roomId: ID!, $materialUrl: String, $activityTypeName: String) {\n  studentReport(\n    roomId: $roomId\n    materialUrl: $materialUrl\n    activityTypeName: $activityTypeName\n  )\n}\n',
			variables: {
				roomId: data.roomId,
				materialUrl: '',
			},
		},
		type: 'start',
	});

	const res = ws.connect(url, params, (socket) => {
		socket.on('open', () => {
			socket.send(JSON.stringify({
				payload: {
					authToken: data.token,
					sessionId: process.env.MOCK_SESSION_ID,
				},
				type: 'connection_init'
			}));
			socket.send(whiteboardEvents);
			socket.send(whiteboardPermissions);
			socket.send(whiteboardState);
			socket.send(room);
			socket.send(studentUsage);
		});

		socket.on('message', (data) => {
			console.log('Message received: ', data)
			counter.add(1);
		});

		socket.setTimeout(function () {
			socket.close();
		}, 2000);

		socket.on('error', (e) => {
			if (e.error() != 'websocket: close sent') {
				console.log('An unexpected error occured: ', JSON.stringify(e));
			}

			errorCounter.add(1);
		});
	});

  	check(res, { 'status is 101': (r) => r && r.status === 101 });
}
