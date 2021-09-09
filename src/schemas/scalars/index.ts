import upload from './upload'
import date from './date'
import uuid from './uuid'
import page_size from './page_size'
import { mergeRawSchemas } from '../helpers/mergeRawSchemas'

export default mergeRawSchemas(upload, date, uuid, page_size)
