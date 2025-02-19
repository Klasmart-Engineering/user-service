import { Context } from '../main'
import { FindOptionsWhere, In, Not } from 'typeorm'
import { AgeRange } from '../entities/ageRange'
import { Organization } from '../entities/organization'
import { Status } from '../entities/status'
import { mapAgeRangeToAgeRangeConnectionNode } from '../pagination/ageRangesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    AgeRangesMutationResult,
    CreateAgeRangeInput,
    DeleteAgeRangeInput,
    UpdateAgeRangeInput,
} from '../types/graphQL/ageRange'
import { ConflictingNameKey, getMap } from '../utils/resolvers/entityMaps'
import { createExistentEntityAttributeAPIError } from '../utils/resolvers/errors'
import {
    flagExistent,
    flagNonExistent,
} from '../utils/resolvers/inputValidation'
import { ObjMap } from '../utils/stringUtils'
import { flagUnauthorized } from '../utils/resolvers/authorization'
import { uniqueAndTruthy } from '../utils/clean'
import {
    CreateMutation,
    DeleteMutation,
    EntityMap,
    filterInvalidInputs,
    ProcessedResult,
    UpdateMutation,
    validateNoDuplicate,
    validateNoDuplicateAttribute,
    validateNumberRange,
    validateNumbersComparison,
} from '../utils/resolvers/commonStructure'
import { config } from '../config/config'
import { AgeRangeUnit } from '../entities/ageRangeUnit'

type ConflictingAgeRangeKey = {
    organizationId?: string
    lowValue: number
    highValue: number
    lowValueUnit: AgeRangeUnit
    highValueUnit: AgeRangeUnit
}

export interface UpdateAgeRangesEntityMap extends EntityMap<AgeRange> {
    mainEntity: Map<string, AgeRange>
    conflictingAgeRanges: ObjMap<ConflictingAgeRangeKey, AgeRange>
    organizationIds: string[]
}

export interface CreateAgeRangesEntityMap extends EntityMap<AgeRange> {
    organizations: Map<string, Organization>
    conflictingNames: ObjMap<ConflictingNameKey, AgeRange>
    conflictingValues: ObjMap<ConflictingAgeRangeKey, AgeRange>
}

export interface DeleteAgeRangesEntityMap extends EntityMap<AgeRange> {
    mainEntity: Map<string, AgeRange>
}

export class CreateAgeRanges extends CreateMutation<
    AgeRange,
    CreateAgeRangeInput,
    AgeRangesMutationResult,
    CreateAgeRangesEntityMap
> {
    protected readonly EntityType = AgeRange
    protected inputTypeName = 'CreateAgeRangeInput'
    protected output: AgeRangesMutationResult = { ageRanges: [] }

    async generateEntityMaps(
        input: CreateAgeRangeInput[]
    ): Promise<CreateAgeRangesEntityMap> {
        const organizationIds: string[] = []
        const names: string[] = []
        const values: ConflictingAgeRangeKey[] = []

        input.forEach((i) => {
            organizationIds.push(i.organizationId)
            names.push(i.name)
            values.push({
                organizationId: i.organizationId,
                lowValue: i.lowValue,
                highValue: i.highValue,
                lowValueUnit: i.lowValueUnit,
                highValueUnit: i.highValueUnit,
            })
        })

        const organizations = await getMap.organization(organizationIds)
        const matchingPreloadedNamesArray = await AgeRange.find({
            where: {
                name: In(names),
                status: Status.ACTIVE,
                organization: In(organizationIds),
            },
        })

        const conflictingNames = new ObjMap<ConflictingNameKey, AgeRange>()
        for (const p of matchingPreloadedNamesArray) {
            const organizationId = p.organization_id
            const name = p.name!
            conflictingNames.set({ organizationId, name }, p)
        }

        const valuesConditions: FindOptionsWhere<AgeRange>[] = values.map(
            (v) => {
                return {
                    low_value: v.lowValue,
                    high_value: v.highValue,
                    low_value_unit: v.lowValueUnit,
                    high_value_unit: v.highValueUnit,
                    organization: In(organizationIds),
                }
            }
        )

        const matchingPreloadedValuesArray = await AgeRange.find({
            where: valuesConditions,
        })

        const conflictingValues = new ObjMap<ConflictingAgeRangeKey, AgeRange>()
        for (const p of matchingPreloadedValuesArray) {
            const organizationId = p.organization_id
            const { low_value, high_value, low_value_unit, high_value_unit } = p
            conflictingValues.set(
                {
                    organizationId,
                    lowValue: low_value,
                    highValue: high_value,
                    lowValueUnit: low_value_unit,
                    highValueUnit: high_value_unit,
                },
                p
            )
        }

        return {
            organizations,
            conflictingNames,
            conflictingValues,
        }
    }

    authorize(input: CreateAgeRangeInput[]): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: input.map((i) => i.organizationId) },
            PermissionName.create_age_range_20222
        )
    }

    validationOverAllInputs(
        inputs: CreateAgeRangeInput[]
    ): {
        validInputs: { index: number; input: CreateAgeRangeInput }[]
        apiErrors: APIError[]
    } {
        const failedDuplicateNames = validateNoDuplicate(
            inputs.map((i) => [i.organizationId, i.name].toString()),
            'ageRange',
            ['name']
        )

        const failedDuplicateValues = validateNoDuplicate(
            inputs.map((i) =>
                [
                    i.lowValue,
                    i.lowValueUnit,
                    i.highValue,
                    i.highValueUnit,
                ].toString()
            ),
            'ageRange',
            ['lowValue', 'lowValueUnit', 'highValue', 'highValueUnit']
        )

        const failedLowValueLessThanHighValue = validateNumbersComparison(
            inputs.map((i) => {
                return { a: i.lowValue, b: i.highValue }
            }),
            'lt',
            'ageRange',
            'lowValue',
            'highValue'
        )

        const failedLowValueInRange = validateNumberRange(
            inputs.map((i) => i.lowValue),
            'ageRange',
            'lowValue',
            config.limits.AGE_RANGE_LOW_VALUE_MIN,
            config.limits.AGE_RANGE_LOW_VALUE_MAX
        )

        const failedHighValueInRange = validateNumberRange(
            inputs.map((i) => i.highValue),
            'ageRange',
            'highValue',
            config.limits.AGE_RANGE_HIGH_VALUE_MIN,
            config.limits.AGE_RANGE_HIGH_VALUE_MAX
        )

        return filterInvalidInputs(inputs, [
            failedDuplicateNames,
            failedDuplicateValues,
            failedLowValueLessThanHighValue,
            failedLowValueInRange,
            failedHighValueInRange,
        ])
    }

    validate(
        index: number,
        _ageRange: undefined,
        currentInput: CreateAgeRangeInput,
        maps: CreateAgeRangesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const {
            organizationId,
            name,
            lowValue,
            lowValueUnit,
            highValue,
            highValueUnit,
        } = currentInput

        const organization = flagNonExistent(
            Organization,
            index,
            [organizationId],
            maps.organizations
        )
        errors.push(...organization.errors)

        const conflictingNameKey: ConflictingNameKey = { organizationId, name }
        const { errors: nameConflictErrors } = flagExistent(
            AgeRange,
            index,
            [conflictingNameKey],
            maps.conflictingNames
        )

        const conflictValueKey: ConflictingAgeRangeKey = {
            lowValue,
            highValue,
            lowValueUnit,
            highValueUnit,
            organizationId,
        }
        const { errors: valueConflictErrors } = flagExistent(
            AgeRange,
            index,
            [conflictValueKey],
            maps.conflictingValues
        )

        errors.push(...nameConflictErrors, ...valueConflictErrors)

        return errors
    }

    protected process(
        currentInput: CreateAgeRangeInput,
        maps: CreateAgeRangesEntityMap
    ) {
        const {
            organizationId,
            name,
            lowValue,
            highValue,
            lowValueUnit,
            highValueUnit,
        } = currentInput

        const ageRange = new AgeRange()
        ageRange.name = name
        ageRange.low_value = lowValue
        ageRange.high_value = highValue
        ageRange.low_value_unit = lowValueUnit
        ageRange.high_value_unit = highValueUnit
        ageRange.organization = Promise.resolve(
            maps.organizations.get(organizationId)!
        )

        return { outputEntity: ageRange }
    }

    protected async buildOutput(outputAgeRange: AgeRange): Promise<void> {
        const ageRangeConnectionNode = mapAgeRangeToAgeRangeConnectionNode(
            outputAgeRange
        )

        this.output.ageRanges.push(ageRangeConnectionNode)
    }
}

export class DeleteAgeRanges extends DeleteMutation<
    AgeRange,
    DeleteAgeRangeInput,
    AgeRangesMutationResult
> {
    protected readonly EntityType = AgeRange
    protected readonly inputTypeName = 'DeleteAgeRangeInput'
    protected readonly output: AgeRangesMutationResult = { ageRanges: [] }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteAgeRangeInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(
        input: DeleteAgeRangeInput[]
    ): Promise<DeleteAgeRangesEntityMap> {
        const ageRanges = getMap.ageRange(
            input.map((i) => i.id),
            ['organization']
        )

        return { mainEntity: await ageRanges }
    }

    async authorize(
        _input: DeleteAgeRangeInput[],
        maps: DeleteAgeRangesEntityMap
    ): Promise<void> {
        flagUnauthorized(
            AgeRange,
            this.mainEntityIds,
            maps.mainEntity,
            'system'
        )

        const organizationIds: string[] = []
        for (const ageRange of maps.mainEntity.values()) {
            const organizationId = ageRange.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_age_range_20442
        )
    }

    async buildOutput(ageRange: AgeRange): Promise<void> {
        this.output.ageRanges.push(
            mapAgeRangeToAgeRangeConnectionNode(ageRange)
        )
    }
}

export class UpdateAgeRanges extends UpdateMutation<
    AgeRange,
    UpdateAgeRangeInput,
    AgeRangesMutationResult,
    UpdateAgeRangesEntityMap
> {
    protected readonly EntityType = AgeRange
    protected inputTypeName = 'UpdateAgeRangeInput'
    protected mainEntityIds: string[] = []
    protected output: AgeRangesMutationResult = { ageRanges: [] }

    constructor(
        input: UpdateAgeRangeInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(
        input: UpdateAgeRangeInput[]
    ): Promise<UpdateAgeRangesEntityMap> {
        const ageRanges = await getMap.ageRange(this.mainEntityIds)

        const preloadedOrgIds = uniqueAndTruthy(
            Array.from(ageRanges.values(), (a) => a.organization_id)
        )

        const values: (ConflictingAgeRangeKey & { id: string })[] = []
        input
            .filter((i) => ageRanges.get(i.id))
            .forEach((i) => {
                values.push({
                    id: i.id,
                    lowValue: i.lowValue || ageRanges.get(i.id)!.low_value,
                    lowValueUnit:
                        i.lowValueUnit || ageRanges.get(i.id)!.low_value_unit,
                    highValue: i.highValue || ageRanges.get(i.id)!.high_value,
                    highValueUnit:
                        i.highValueUnit || ageRanges.get(i.id)!.high_value_unit,
                    organizationId: ageRanges.get(i.id)!.organization_id,
                })
            })

        const conflictingAgeRanges = new ObjMap<
            ConflictingAgeRangeKey,
            AgeRange
        >()
        if (values.length > 0) {
            const valuesConditions: FindOptionsWhere<AgeRange>[] = values.map(
                (v) => {
                    return {
                        low_value: v.lowValue,
                        high_value: v.highValue,
                        low_value_unit: v.lowValueUnit,
                        high_value_unit: v.highValueUnit,
                        organization: In(preloadedOrgIds),
                        id: Not(v.id),
                    }
                }
            )
            const preloadedMatchingAgeRanges = AgeRange.find({
                where: valuesConditions,
            })
            for (const ageRange of await preloadedMatchingAgeRanges) {
                conflictingAgeRanges.set(
                    {
                        organizationId: ageRange.organization_id,
                        lowValue: ageRange.low_value,
                        lowValueUnit: ageRange.low_value_unit,
                        highValue: ageRange.high_value,
                        highValueUnit: ageRange.high_value_unit,
                    },
                    ageRange
                )
            }
        }

        return {
            mainEntity: ageRanges,
            conflictingAgeRanges,
            organizationIds: preloadedOrgIds,
        }
    }

    async authorize(
        _input: UpdateAgeRangeInput[],
        maps: UpdateAgeRangesEntityMap
    ): Promise<void> {
        flagUnauthorized(
            AgeRange,
            this.mainEntityIds,
            maps.mainEntity,
            'system'
        )
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: maps.organizationIds },
            PermissionName.edit_age_range_20332
        )
    }

    validationOverAllInputs(
        inputs: UpdateAgeRangeInput[],
        maps: UpdateAgeRangesEntityMap
    ): {
        validInputs: { index: number; input: UpdateAgeRangeInput }[]
        apiErrors: APIError[]
    } {
        const failedDuplicates = validateNoDuplicate(
            inputs.map((i) => i.id),
            this.inputTypeName,
            ['id']
        )

        const values = []
        for (const {
            id,
            lowValue,
            lowValueUnit,
            highValue,
            highValueUnit,
        } of inputs) {
            const ageRange = maps.mainEntity.get(id)
            let organizationId = undefined
            if (ageRange) organizationId = ageRange.organization_id

            values.push({
                entityId: organizationId,
                attributeValue: [
                    lowValue,
                    lowValueUnit,
                    highValue,
                    highValueUnit,
                ].join('-'),
            })
        }

        const failedDuplicateInOrg = validateNoDuplicateAttribute(
            values,
            'Age Range',
            'lowValue-lowValueUnit-highValue-highValueUnit'
        )

        const failedLowValueLessThanHighValue = validateNumbersComparison(
            inputs.map((i) => {
                return {
                    a:
                        i.lowValue ||
                        (maps.mainEntity.get(i.id)?.low_value ?? 0),
                    b:
                        i.highValue ||
                        (maps.mainEntity.get(i.id)?.high_value ?? 99),
                }
            }),
            'lt',
            'ageRange',
            'lowValue',
            'highValue'
        )

        const failedLowValueInRange = validateNumberRange(
            inputs.map(
                (i) => i.lowValue || (maps.mainEntity.get(i.id)?.low_value ?? 0)
            ),
            'ageRange',
            'lowValue',
            config.limits.AGE_RANGE_LOW_VALUE_MIN,
            config.limits.AGE_RANGE_LOW_VALUE_MAX
        )

        const failedHighValueInRange = validateNumberRange(
            inputs.map(
                (i) =>
                    i.highValue || (maps.mainEntity.get(i.id)?.high_value ?? 99)
            ),
            'ageRange',
            'highValue',
            config.limits.AGE_RANGE_HIGH_VALUE_MIN,
            config.limits.AGE_RANGE_HIGH_VALUE_MAX
        )

        return filterInvalidInputs(inputs, [
            failedDuplicates,
            failedDuplicateInOrg,
            failedLowValueLessThanHighValue,
            failedLowValueInRange,
            failedHighValueInRange,
        ])
    }

    validate(
        index: number,
        _ageRange: AgeRange,
        currentInput: UpdateAgeRangeInput,
        maps: UpdateAgeRangesEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const {
            id,
            lowValue,
            lowValueUnit,
            highValue,
            highValueUnit,
        } = currentInput

        const ageRangeExists = flagNonExistent(
            AgeRange,
            index,
            [id],
            maps.mainEntity
        )
        errors.push(...ageRangeExists.errors)

        if (ageRangeExists.values.length !== 1) return errors
        const existingAgeRange = ageRangeExists.values[0]

        const conflictingAgeRange = maps.conflictingAgeRanges.get({
            organizationId: existingAgeRange.organization_id,
            lowValue: lowValue || existingAgeRange.low_value,
            lowValueUnit: lowValueUnit || existingAgeRange.low_value_unit,
            highValue: highValue || existingAgeRange.high_value,
            highValueUnit: highValueUnit || existingAgeRange.high_value_unit,
        })?.id

        if (conflictingAgeRange) {
            errors.push(
                createExistentEntityAttributeAPIError(
                    'Age Range',
                    conflictingAgeRange,
                    'lowValue-lowValueUnit-highValue-highValueUnit combination',
                    id,
                    index
                )
            )
        }

        return errors
    }

    protected process(
        currentInput: UpdateAgeRangeInput,
        maps: UpdateAgeRangesEntityMap
    ): ProcessedResult<AgeRange, AgeRange> {
        const {
            id,
            name,
            lowValue,
            lowValueUnit,
            highValue,
            highValueUnit,
        } = currentInput
        const ageRange = maps.mainEntity.get(id)!
        ageRange.name = name || ageRange.name
        ageRange.low_value = lowValue || ageRange.low_value
        ageRange.low_value_unit = lowValueUnit || ageRange.low_value_unit
        ageRange.high_value = highValue || ageRange.high_value
        ageRange.high_value_unit = highValueUnit || ageRange.high_value_unit

        return { outputEntity: ageRange }
    }

    protected async buildOutput(outputAgeRange: AgeRange): Promise<void> {
        const ageRangeConnectionNode = mapAgeRangeToAgeRangeConnectionNode(
            outputAgeRange
        )
        this.output.ageRanges.push(ageRangeConnectionNode)
    }
}
