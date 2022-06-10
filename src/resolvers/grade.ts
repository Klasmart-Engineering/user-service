import { Grade } from '../entities/grade'
import { Context } from '../main'
import { mapGradeToGradeConnectionNode } from '../pagination/gradesConnection'
import { PermissionName } from '../permissions/permissionNames'
import { GradesMutationResult, DeleteGradeInput } from '../types/graphQL/grade'
import { DeleteMutation, EntityMap } from '../utils/resolvers/commonStructure'
import { getMap } from '../utils/resolvers/entityMaps'
import { flagUnauthorized } from '../utils/resolvers/authorization'

export interface DeleteGradesEntityMap extends EntityMap<Grade> {
    mainEntity: Map<string, Grade>
}

export class DeleteGrades extends DeleteMutation<
    Grade,
    DeleteGradeInput,
    GradesMutationResult
> {
    protected readonly EntityType = Grade
    protected readonly inputTypeName = 'DeleteGradeInput'
    protected readonly output: GradesMutationResult = { grades: [] }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteGradeInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(
        input: DeleteGradeInput[]
    ): Promise<DeleteGradesEntityMap> {
        const grades = getMap.grade(this.mainEntityIds, ['organization'])
        return { mainEntity: await grades }
    }

    async authorize(
        _input: DeleteGradeInput[],
        maps: DeleteGradesEntityMap
    ): Promise<void> {
        flagUnauthorized(Grade, this.mainEntityIds, maps.mainEntity, 'system')

        const organizationIds: string[] = []
        for (const grade of maps.mainEntity.values()) {
            const organizationId = grade.organization_id
            if (organizationId) organizationIds.push(organizationId)
        }

        return this.permissions.rejectIfNotAllowed(
            { organization_ids: organizationIds },
            PermissionName.delete_grade_20443
        )
    }

    async buildOutput(grade: Grade): Promise<void> {
        this.output.grades.push(mapGradeToGradeConnectionNode(grade))
    }
}
