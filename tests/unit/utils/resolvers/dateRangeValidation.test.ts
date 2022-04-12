import { expect } from 'chai'
import {
    DateRangeWithIndex,
    IDateRange,
    validateDateRanges,
    validateNoDateOverlapsForParent,
} from '../../../../src/utils/resolvers/dateRangeValidation'
import {
    createInvalidDateRangeAPIError,
    createOverlappingDateRangeAPIError,
} from '../../../../src/utils/resolvers/errors'
import { compareErrors, compareMultipleErrors } from '../../../utils/apiError'

describe('dateRangeValidation', () => {
    describe('#validateDateRanges', () => {
        let dateRanges: IDateRange[]

        beforeEach(() => {
            dateRanges = [
                {
                    startDate: new Date('2020-01-01'),
                    endDate: new Date('2020-01-31'),
                },
                {
                    startDate: new Date('2020-12-01'),
                    endDate: new Date('2021-01-01'),
                },
            ]
        })

        context('when all date ranges are valid', () => {
            it('should return an empty map', () => {
                expect(validateDateRanges(dateRanges).size).to.eq(0)
            })
        })

        context('when some date ranges are invalid', () => {
            it('should record errors with correct indices', () => {
                dateRanges[1] = {
                    startDate: new Date('2023-12-01'), // startDate is now after endDate
                    endDate: new Date('2021-01-01'),
                }
                const expectedAPIError = createInvalidDateRangeAPIError(1, [
                    'startDate',
                    'endDate',
                ])
                expect(validateDateRanges(dateRanges).size).to.eq(1)
                compareErrors(
                    validateDateRanges(dateRanges).get(1)!,
                    expectedAPIError
                )
            })
        })
    })

    describe('#validateNoDateOverlaps', () => {
        const someChildEntity = 'someChildEntity'
        const someParentEntity = 'someParentEntity'
        const someParentEntityAttribute = 'someParentEntityAttribute'
        const someParentEntityAttributeValue = 'someParentEntityAttributeValue'

        const overlapErrorFactory = (
            dateRangesWithIndex: DateRangeWithIndex[],
            offendingInputIndex: number,
            offendingIndex: number,
            overlappedIndex: number
        ) => {
            return createOverlappingDateRangeAPIError(
                offendingInputIndex,
                ['startDate', 'endDate'],
                someChildEntity,
                someParentEntity,
                {
                    startDate: dateRangesWithIndex[offendingIndex].startDate,
                    endDate: dateRangesWithIndex[offendingIndex].endDate,
                },
                {
                    startDate: dateRangesWithIndex[overlappedIndex].startDate,
                    endDate: dateRangesWithIndex[overlappedIndex].endDate,
                },
                someParentEntityAttribute,
                someParentEntityAttributeValue
            )
        }

        context('date ranges are not in chronological order', () => {
            let dateRangesWithIndex: DateRangeWithIndex[]

            beforeEach(() => {
                dateRangesWithIndex = [
                    {
                        index: 0,
                        startDate: new Date('2025-01-01'),
                        endDate: new Date('2025-02-01'),
                    },
                    {
                        index: 1,
                        startDate: new Date('2023-01-01'),
                        endDate: new Date('2023-06-01'),
                    },
                    {
                        index: 2,
                        startDate: new Date('2021-01-01'),
                        endDate: new Date('2021-06-01'),
                    },
                ]
            })

            it('sorts dates by start date before validating', () => {
                // If the algorithm didn't sort the date ranges by startDate, there would be errors because of startDate-endDate comparisons
                expect(
                    validateNoDateOverlapsForParent(
                        dateRangesWithIndex,
                        someChildEntity,
                        someParentEntity,
                        someParentEntityAttribute,
                        someParentEntityAttributeValue
                    ).size
                ).to.eq(0)
            })
        })

        context(
            'all date ranges have index (i.e. all are subject to checks)',
            () => {
                let dateRangesWithIndex: DateRangeWithIndex[]

                beforeEach(() => {
                    dateRangesWithIndex = [
                        {
                            index: 0,
                            startDate: new Date('2020-01-01'),
                            endDate: new Date('2020-01-31'),
                        },
                        {
                            index: 1,
                            startDate: new Date('2020-12-01'),
                            endDate: new Date('2021-01-01'),
                        },
                    ]
                })

                context('all date ranges do not overlap', () => {
                    it('should return an empty map', () => {
                        expect(
                            validateNoDateOverlapsForParent(
                                dateRangesWithIndex,
                                someChildEntity,
                                someParentEntity,
                                someParentEntityAttribute,
                                someParentEntityAttributeValue
                            ).size
                        ).to.eq(0)
                    })
                })

                context('some date ranges overlap', () => {
                    it('should record errors with correct indices for date ranges which are not equal and overlap, and includes first index if offending', () => {
                        dateRangesWithIndex[1] = {
                            index: 1,
                            startDate: new Date('2020-01-15'), // Starts before endDate of previous date range
                            endDate: new Date('2021-01-01'),
                        }
                        const expectedAPIErrors = [
                            overlapErrorFactory(dateRangesWithIndex, 0, 0, 1),
                            overlapErrorFactory(dateRangesWithIndex, 1, 1, 0),
                        ]
                        const actualResult = validateNoDateOverlapsForParent(
                            dateRangesWithIndex,
                            someChildEntity,
                            someParentEntity,
                            someParentEntityAttribute,
                            someParentEntityAttributeValue
                        )
                        expect(actualResult.size).to.eq(2)
                        compareMultipleErrors(
                            Array.from(actualResult.values()),
                            expectedAPIErrors
                        )
                    })

                    it('should record errors with correct indices for date ranges which are not equal and overlap, and only records one error if first index not involved', () => {
                        dateRangesWithIndex.push({
                            index: 2,
                            startDate: new Date('2020-12-15'), // Starts before endDate of previous date range
                            endDate: new Date('2022-01-01'),
                        })
                        const expectedAPIError = overlapErrorFactory(
                            dateRangesWithIndex,
                            2,
                            2,
                            1
                        )
                        const actualResult = validateNoDateOverlapsForParent(
                            dateRangesWithIndex,
                            someChildEntity,
                            someParentEntity,
                            someParentEntityAttribute,
                            someParentEntityAttributeValue
                        )
                        expect(actualResult.size).to.eq(1)
                        compareErrors(actualResult.get(2)!, expectedAPIError)
                    })

                    it('should record errors with correct indices for dates ranges whose start and end dates are equal (total eclipse!)', () => {
                        dateRangesWithIndex.push({
                            index: 2,
                            startDate: new Date('2020-12-01'), // Equal to previous startDate
                            endDate: new Date('2021-01-01'), // Equal to previous endDate
                        })
                        const expectedAPIError = overlapErrorFactory(
                            dateRangesWithIndex,
                            2,
                            2,
                            1
                        )
                        const actualResult = validateNoDateOverlapsForParent(
                            dateRangesWithIndex,
                            someChildEntity,
                            someParentEntity,
                            someParentEntityAttribute,
                            someParentEntityAttributeValue
                        )
                        expect(actualResult.size).to.eq(1)
                        compareErrors(actualResult.get(2)!, expectedAPIError)
                    })

                    it('should record errors with correct indices for dates ranges which share an equal date', () => {
                        // Here we just test previous endDate = current startDate
                        // Because after sorting, there won't be a previous startDate = current endDate case
                        dateRangesWithIndex.push({
                            index: 2,
                            startDate: new Date('2021-01-01'), // Equal to previous endDate
                            endDate: new Date('2021-01-02'),
                        })
                        const expectedAPIError = overlapErrorFactory(
                            dateRangesWithIndex,
                            2,
                            2,
                            1
                        )
                        const actualResult = validateNoDateOverlapsForParent(
                            dateRangesWithIndex,
                            someChildEntity,
                            someParentEntity,
                            someParentEntityAttribute,
                            someParentEntityAttributeValue
                        )
                        expect(actualResult.size).to.eq(1)
                        compareErrors(actualResult.get(2)!, expectedAPIError)
                    })
                })
            }
        )

        context(
            'some date ranges have index (i.e. non-index date ranges are source of truth which indexed date ranges are checked against)',
            () => {
                let dateRangesWithIndex: DateRangeWithIndex[]

                beforeEach(() => {
                    dateRangesWithIndex = [
                        {
                            index: 0,
                            startDate: new Date('2020-01-01'),
                            endDate: new Date('2020-01-31'),
                        },
                        {
                            index: undefined,
                            startDate: new Date('2020-12-01'),
                            endDate: new Date('2021-01-01'),
                        },
                    ]
                })

                context('some date ranges overlap', () => {
                    it('should record errors with correct indices for indexed date ranges which overlap with non-indexed date ranges, if first index is offending', () => {
                        dateRangesWithIndex[0] = {
                            index: 0,
                            startDate: new Date('2020-01-01'),
                            endDate: new Date('2021-01-01'), // Equal to non-indexed endDate, so complete overlap
                        }
                        const expectedAPIError = overlapErrorFactory(
                            dateRangesWithIndex,
                            0,
                            0,
                            1
                        )
                        const actualResult = validateNoDateOverlapsForParent(
                            dateRangesWithIndex,
                            someChildEntity,
                            someParentEntity,
                            someParentEntityAttribute,
                            someParentEntityAttributeValue
                        )
                        expect(actualResult.size).to.eq(1)
                        compareErrors(actualResult.get(0)!, expectedAPIError)
                    })

                    it('should record errors with correct indices for indexed date ranges which overlap with non-indexed date ranges, for any other index', () => {
                        dateRangesWithIndex.push({
                            index: 1,
                            startDate: new Date('2020-12-15'), // Overlaps with previous (non-index) entry's endDate
                            endDate: new Date('2022-01-01'),
                        })
                        const expectedAPIError = overlapErrorFactory(
                            dateRangesWithIndex,
                            1,
                            2,
                            1
                        )
                        const actualResult = validateNoDateOverlapsForParent(
                            dateRangesWithIndex,
                            someChildEntity,
                            someParentEntity,
                            someParentEntityAttribute,
                            someParentEntityAttributeValue
                        )
                        expect(actualResult.size).to.eq(1)
                        expect(Array.from(actualResult.keys())).to.deep.eq([1])
                        compareErrors(actualResult.get(1)!, expectedAPIError)
                    })
                })
            }
        )
    })
})
