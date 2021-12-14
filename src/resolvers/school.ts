import { School } from '../entities/school'
import { Context } from '../main'
import {
    schoolConnectionNodeFields,
    mapSchoolToSchoolConnectionNode,
} from '../pagination/schoolsConnection'
import { PermissionName } from '../permissions/permissionNames'
import {
    DeleteSchoolInput,
    SchoolsMutationResult,
} from '../types/graphQL/school'
import { DeleteMutation, EntityMap } from '../utils/mutations/commonStructure'

export class DeleteSchools extends DeleteMutation<
    School,
    DeleteSchoolInput,
    SchoolsMutationResult
> {
    protected readonly EntityType = School
    protected readonly EntityPrimaryKey = School
    protected readonly inputTypeName = 'DeleteSchoolInput'
    protected readonly mainEntityIds: string[]
    protected readonly output: SchoolsMutationResult

    constructor(
        input: DeleteSchoolInput[],
        context: Pick<Context, 'permissions'>
    ) {
        super(input, context)
        this.mainEntityIds = input.map((val) => val.id)
        this.output = { schools: [] }
    }

    protected async generateEntityMaps(): Promise<EntityMap<School>> {
        const categories = await School.createQueryBuilder()
            .select([
                ...schoolConnectionNodeFields,
                'Organization.organization_id',
            ])
            .leftJoin('School.organization', 'Organization')
            .where('School.school_id IN (:...ids)', { ids: this.mainEntityIds })
            .getMany()
        return { mainEntity: new Map(categories.map((c) => [c.school_id, c])) }
    }

    protected async authorize(
        _input: DeleteSchoolInput[],
        entityMaps: EntityMap<School>
    ) {
        const organizationIds: string[] = []
        for (const c of entityMaps.mainEntity.values()) {
            const organizationId = (await c.organization)?.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }
        await this.context.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_school_20440
        )
    }

    protected async buildOutput(currentEntity: School): Promise<void> {
        this.output.schools.push(
            await mapSchoolToSchoolConnectionNode(currentEntity)
        )
    }
}
