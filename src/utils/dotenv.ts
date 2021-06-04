// Ensure environment variables from .env are set before evaluating any references
// by importing this file at the very beginning of the app entry point (main.ts)

// https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'
dotenv.config({ path: __dirname + '/../../.env' })
