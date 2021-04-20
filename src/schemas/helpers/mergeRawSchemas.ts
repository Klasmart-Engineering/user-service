import { mergeWith, isArray } from 'lodash'

// will merge typedefs into an array
function withArraysConcatination(objValue: any, srcValue: any) {
    // if have an array, concat it
    if (isArray(objValue)) {
        return objValue.concat(srcValue)
    }
}

// allows us to merge schemas
export const mergeRawSchemas = (...schemas: any) => {
    return mergeWith({}, ...schemas, withArraysConcatination)
}
