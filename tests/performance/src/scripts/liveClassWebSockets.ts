import ws from 'k6/ws';
import { check } from 'k6';

export default function () {
  const url = 'wss://live.alpha.kidsloop.net/graphql';
  const params = { tags: { my_tag: 'hello' } };
//   const params = {
//     payload: {

//     },
//     type: "connection_init"
//   }

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => console.log('connected'));
    socket.on('message', (data) => console.log('Message received: ', data));
    socket.on('close', () => console.log('disconnected'));
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}


// https://live.alpha.kidsloop.net/?
// token=eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJraWRzbG9vcC1saXZlIiwiZXhwIjoxNjQzMjI5MTgwLCJpYXQiOjE2NDMyMTc1NTksImlzcyI6IktpZHNMb29wVXNlci1saXZlIiwic3ViIjoiYXV0aG9yaXphdGlvbiIsIm5hbWUiOiJBbGV4IFBlcmV6Iiwic2NoZWR1bGVfaWQiOiI2MWYxODFkM2M3YTMzYjMwODZmMDhjM2UiLCJ1c2VyX2lkIjoiMWNkM2UxNzgtNzU2MS00YTRjLWFkZjMtZDY5NjIwYzk2Y2I0IiwidHlwZSI6ImxpdmUiLCJ0ZWFjaGVyIjp0cnVlLCJyb29taWQiOiI2MWYxODFkM2M3YTMzYjMwODZmMDhjM2UiLCJtYXRlcmlhbHMiOlt7ImlkIjoiNjA4OGM3ZDJkNDFlZGY0Nzk5NzNmM2U3IiwibmFtZSI6Ikg1UF9UZXN0aW5nX0NvdXJzZVByZXNlbnRhdGlvbjMiLCJ1cmwiOiIvaDVwL3BsYXkvNjA4OGM3Y2QzN2NkN2QwMDE0MjdlYmNhIiwiX190eXBlbmFtZSI6IklmcmFtZSJ9LHsiaWQiOiI2MDg4YmFhMWQ0MWVkZjQ3OTk3M2YyOTQiLCJuYW1lIjoiSDVQX1Rlc3RpbmdfQ291cnNlUHJlc2VudGF0aW9uMiIsInVybCI6Ii9oNXAvcGxheS82MDg4YmE5ZTM3Y2Q3ZDAwMTQyN2ViYzgiLCJfX3R5cGVuYW1lIjoiSWZyYW1lIn0seyJpZCI6IjYwYjU3YWU2NTMzZTZhMzE3YWEyY2M5YiIsIm5hbWUiOiJINVBfVGVzdGluZ19EcmFnVGV4dCIsInVybCI6Ii9oNXAvcGxheS82MDgyYmU2MzZkN2U2NTAwMTMzODI0NjQiLCJfX3R5cGVuYW1lIjoiSWZyYW1lIn0seyJpZCI6IjYwODJiYzc0Yjk2YzRkMDA0YmQwNWYzOSIsIm5hbWUiOiJINVBfVGVzdGluZ19NYXJrdGhlV29yZHMiLCJ1cmwiOiIvaDVwL3BsYXkvNjA4MmJjNzA2ZDdlNjUwMDEzMzgyNDYzIiwiX190eXBlbmFtZSI6IklmcmFtZSJ9XSwiY2xhc3N0eXBlIjoibGl2ZSIsIm9yZ19pZCI6ImRlNmU4NTBhLWNmOTctNGUwYi1hYTk2LWMwZmVkY2RhNzFiZSIsInN0YXJ0X2F0IjoxNjQzMjE3NjAwLCJlbmRfYXQiOjE2NDMyMjgyODB9.isLKfQ1yfbmhotJKCb84ZRH8GbcuVAZv65ToruQyKWQoev8hKSn-t1I1Xw_1EIYOccCdnQmKxtrdolbO9wBLd5zEbOJPVXai2-g6126JZIKMAdBDt87fOFu0qD9LYQnsPnVGpsmss36Fu8Gpj6M8Oxur_t2J8zicok9QOuioC0w