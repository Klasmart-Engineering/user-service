import { Context } from 'mocha'
import { AgeRange } from '../entities/ageRange'
import { mapAgeRangeToAgeRangeConnectionNode } from '../pagination/ageRangesConnection'
import { PermissionName } from '../permissions/permissionNames'
import {
    AgeRangesMutationResult,
    DeleteAgeRangeInput,
} from '../types/graphQL/ageRange'
import { DeleteMutation, EntityMap } from '../utils/mutations/commonStructure'
import { getMap } from '../utils/resolvers/entityMaps'

export interface DeleteAgeRangesEntityMap extends EntityMap<AgeRange> {
    mainEntity: Map<string, AgeRange>
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
        const organizationIds: string[] = []
        for (const s of maps.mainEntity.values()) {
            // eslint-disable-next-line no-await-in-loop
            const organizationId = (await s.organization)?.organization_id
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
