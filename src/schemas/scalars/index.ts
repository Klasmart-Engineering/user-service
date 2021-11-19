import upload from './upload'
import date from './date'
import uuid from './uuid'
import page_size from './page_size'
import { GraphQLSchemaModule } from '../../types/schemaModule'

const scalarModules: GraphQLSchemaModule[] = [upload, date, uuid, page_size]

export default scalarModules
