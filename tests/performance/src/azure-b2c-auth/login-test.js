import {
  defaultOptions
} from './common';
import { loginToB2C } from './functions.js';

export const options = defaultOptions;

export default function main(data) {
  loginToB2C();
}