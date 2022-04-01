export interface BaseError {
    code: string
    message: string
}

// TODO: remove once all legacy `ERR_CSV_` codes are migrated to the new format
// and merge any still required params into `ErrorParams`
export interface LegacyErrorParams {
    name?: string
    parent_name?: string
    parent_entity?: string
    other?: string
    values?: string
    other_entity?: string
    other_attribute?: string
    count?: number
}

export interface ErrorParams {
    entity?: string
    attribute?: string
    attributeValue?: string
    otherAttribute?: string
    organizationName?: string
    entityName?: string
    parentEntity?: string
    parentName?: string
    min?: number
    max?: number
    format?: string
    index?: number
    fields?: string
    fieldValues?: Record<string, unknown>[]
}
