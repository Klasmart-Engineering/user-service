from argparse import ArgumentParser
from authlib.jose import jwt
import sys

def generate_token(payload):
    protected = {'alg': 'HS256'}

    with open('debug_user_service_secret') as f:
        key =  f.read().strip()
        return jwt.encode(protected, payload, key, check=True).decode('utf-8')

def main(args):
    payload = {
        'iss': 'calmid-debug',
        'id': args.id,
        'name': args.name,
        'email': args.email,
        'admin': True
    }

    token = generate_token(payload)
    print(token)


if __name__ == '__main__':
    parser = ArgumentParser(description='Token generator for user service')
    parser.add_argument('-i', '--id', type=str,
                        help='user id')
    parser.add_argument('-n', '--name', type=str,
                        help='user name')
    parser.add_argument('-e', '--email', type=str,
                        help='user email')

    main(parser.parse_args())
