import upload from './upload'
import date from './date'
import uuid from './uuid'
import { mergeRawSchemas } from '../helpers/mergeRawSchemas'

export default mergeRawSchemas(upload, date, uuid)
