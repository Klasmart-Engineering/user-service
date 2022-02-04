import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

export const defaultOptions = {
  vus: 1,
  iterations: 1,
};

export function generateCodeChallenge() {

  const verifier = encoding.b64encode(crypto.randomBytes(32), 'rawurl')

  const challenge = crypto.sha256(verifier, 'base64rawurl');

  return {
    verifier: verifier,
    challenge: challenge
  };
};