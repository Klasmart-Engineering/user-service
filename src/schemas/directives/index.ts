import isAdmin from './isAdmin'
import isAuthenticated from './isAuthenticated'
import isMIMEType from './isMIMEType'
import { GraphQLSchemaModule } from '../../types/schemaModule'

const directivesModules: GraphQLSchemaModule[] = [
    isAdmin,
    isAuthenticated,
    isMIMEType,
]

export default directivesModules
