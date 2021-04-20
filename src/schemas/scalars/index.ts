import upload from './upload'
import date from './date'
import { mergeRawSchemas } from '../helpers/mergeRawSchemas'

export default mergeRawSchemas(upload, date)
