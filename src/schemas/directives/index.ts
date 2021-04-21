import depreciated from './depreciated'
import isAdmin from './isAdmin'
import isAuthenticated from './isAuthenticated'
import isMIMEType from './isMIMEType'
import { mergeRawSchemas } from '../helpers/mergeRawSchemas'

export default mergeRawSchemas(
    depreciated,
    isAdmin,
    isAuthenticated,
    isMIMEType
)
