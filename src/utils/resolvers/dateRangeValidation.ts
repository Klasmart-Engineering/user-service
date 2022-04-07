import { APIError } from '../../types/errors/apiError'
import { createInvalidDateRangeAPIError } from '../resolvers/errors'
import { sortObjectArray } from '../array'
import { createOverlappingDateRangeAPIError } from '../resolvers/errors'

export interface IDateRange {
    startDate: Date
    endDate: Date
}

export interface DateRangeWithIndex extends IDateRange {
    index: number | undefined
}

/**
 * Checks that each DateRange set satisfies startDate < endDate or not
 */
export function validateDateRanges(
    values: IDateRange[]
): Map<number, APIError> {
    const errors = new Map<number, APIError>()
    for (const [index, value] of values.entries()) {
        if (value.endDate.getTime() <= value.startDate.getTime()) {
            errors.set(
                index,
                createInvalidDateRangeAPIError(index, ['startDate', 'endDate'])
            )
        }
    }
    return errors
}

/**
 * Date overlap validation for child entities (represented with date ranges) under an associated parent entity (for the purposes of error messaging)
 * Assumes the date ranges have been validated to be startDate < endDate. Sorts inputs array by ascending start date.
 * Entries without index are treated as "existing/non-overlapping" ranges that entries with index are checked against.
 */
export function validateNoDateOverlapsForParent(
    inputs: DateRangeWithIndex[],
    entity: string,
    parentEntity: string,
    parentEntityAttribute: string,
    parentEntityAttributeValue: string
): Map<number, APIError> {
    const errors = new Map<number, APIError>()

    // Make sure dates are chronologically sorted by startDate first before overlap algorithm
    const sortedATsIndices = sortObjectArray(inputs, 'startDate')

    // Check for overlaps
    if (sortedATsIndices.length) {
        let previousEndDate = sortedATsIndices[0].endDate
        for (let i = 0; i < sortedATsIndices.length; i++) {
            // 1st entry must be checked against 2nd entry if it is chronologically first and has index (i.e. new input)
            if (i == 0) {
                if (
                    sortedATsIndices[i].index != undefined && // Consider this input to validate if input index's value is not undefined
                    sortedATsIndices[i + 1] !== undefined && // Is there a 2nd date range in the array to validate this first input against?
                    sortedATsIndices[i].startDate.getTime() <=
                        sortedATsIndices[i + 1].startDate.getTime() &&
                    sortedATsIndices[i].endDate.getTime() >=
                        sortedATsIndices[i + 1].startDate.getTime()
                ) {
                    errors.set(
                        sortedATsIndices[i].index!,
                        createOverlappingDateRangeAPIError(
                            sortedATsIndices[i].index!,
                            ['startDate', 'endDate'],
                            entity,
                            parentEntity,
                            {
                                startDate: sortedATsIndices[i].startDate,
                                endDate: sortedATsIndices[i].endDate,
                            },
                            {
                                startDate: sortedATsIndices[i + 1].startDate,
                                endDate: sortedATsIndices[i + 1].endDate,
                            },
                            parentEntityAttribute,
                            parentEntityAttributeValue
                        )
                    )
                }
            } else if (
                sortedATsIndices[i].index != undefined &&
                sortedATsIndices[i].startDate.getTime() <=
                    previousEndDate.getTime()
            ) {
                errors.set(
                    sortedATsIndices[i].index!,
                    createOverlappingDateRangeAPIError(
                        sortedATsIndices[i].index!,
                        ['startDate', 'endDate'],
                        entity,
                        parentEntity,
                        {
                            startDate: sortedATsIndices[i].startDate,
                            endDate: sortedATsIndices[i].endDate,
                        },
                        {
                            startDate: sortedATsIndices[i - 1].startDate,
                            endDate: sortedATsIndices[i - 1].endDate,
                        },
                        parentEntityAttribute,
                        parentEntityAttributeValue
                    )
                )
            }
            previousEndDate = sortedATsIndices[i].endDate // This sits outside of if statements to keep track of non-index entries' end dates
        }
    }

    return errors
}
