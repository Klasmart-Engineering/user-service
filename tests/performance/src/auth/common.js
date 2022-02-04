import { APIHeaders as importedHeaders } from '../utils/common';
import { Counter } from 'k6/metrics';

export const APIHeaders = importedHeaders;

export const AuthEndpoint = `https://auth.${env.APP_URL}`;

export const defaultOptions = {
  vus: 1,
  iterations: 1,
};

export const requestOverThreshold = new Counter('requests over specified threshold', false);

export const threshold = 1000000;