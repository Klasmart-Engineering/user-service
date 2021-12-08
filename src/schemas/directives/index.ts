import isAdmin from './isAdmin'
import isAuthenticated from './isAuthenticated'
import isMIMEType from './isMIMEType'
import { GraphQLSchemaModule } from '../../types/schemaModule'
import complexity from './complexity'

const directivesModules: GraphQLSchemaModule[] = [
    isAdmin,
    isAuthenticated,
    isMIMEType,
    complexity,
]

export default directivesModules
