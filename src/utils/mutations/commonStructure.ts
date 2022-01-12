import { getManager } from 'typeorm'
import { config } from '../../config/config'
import { CustomBaseEntity } from '../../entities/customBaseEntity'
import { Status } from '../../entities/status'
import { Context } from '../../main'
import { APIError, APIErrorCollection } from '../../types/errors/apiError'
import {
    createDatabaseSaveAPIError,
    createDuplicateAttributeAPIError,
    createDuplicateInputAttributeAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
} from '../resolvers/errors'
import { objectToKey, ObjMap } from '../stringUtils'

export interface EntityMap<EntityType extends CustomBaseEntity> {
    mainEntity?: Map<string, EntityType>
    [key: string]:
        | Map<string, CustomBaseEntity | CustomBaseEntity[]>
        | ObjMap<{ [key: string]: string }, unknown>
        | undefined
}

type MembershipIdPair = { entityId: string; attributeValue: string }

// this will not create an error for the first input
// with a given attribute value, only subsequent duplicates
export function validateNoDuplicateAttribute(
    values: MembershipIdPair[],
    entityTypeName: string,
    attributeName: string
): Map<number, APIError> {
    const valueSet = new Set<string>()
    const errors = new Map<number, APIError>()
    for (const [index, value] of values.entries()) {
        const key = objectToKey(value)
        if (valueSet.has(key)) {
            errors.set(
                index,
                createDuplicateInputAttributeAPIError(
                    index,
                    entityTypeName,
                    value.entityId,
                    attributeName,
                    value.attributeValue
                )
            )
        } else {
            valueSet.add(key)
        }
    }
    return errors
}

// this will not create an error for the first input
// with a given attribute value, only subsequent duplicates
export function validateNoDuplicate(
    values: string[],
    inputTypeName: string,
    attributeName: string
): Map<number, APIError> {
    const valueSet = new Set<string>()
    const errors = new Map<number, APIError>()
    for (const [index, value] of values.entries()) {
        if (valueSet.has(value)) {
            errors.set(
                index,
                createDuplicateAttributeAPIError(
                    index,
                    [attributeName],
                    inputTypeName
                )
            )
        } else {
            valueSet.add(value)
        }
    }
    return errors
}

// this will only create errors for the first instance of each
// inactive ID
function validateActiveEntityExists(
    ids: string[],
    entityTypeName: string,
    entities: Map<string, CustomBaseEntity>
): Map<number, APIError> {
    const errors: Map<number, APIError> = new Map()
    const alreadyErrored = new Set<string>()
    for (const [index, id] of ids.entries()) {
        const mainEntity = entities.get(id)
        if (
            !mainEntity ||
            // we only generate this error once per ID
            // and rely on duplicate error checking to flag the rest
            (mainEntity.status !== Status.ACTIVE && !alreadyErrored.has(id))
        ) {
            alreadyErrored.add(id)
            errors.set(
                index,
                createEntityAPIError('nonExistent', index, entityTypeName, id)
            )
        }
    }
    return errors
}

export function validateActiveAndNoDuplicates<A, B extends CustomBaseEntity>(
    inputs: A[],
    entityMaps: EntityMap<B>,
    mainEntityIds: string[],
    entityTypeName: string,
    inputTypeName: string
): {
    validInputs: { index: number; input: A }[]
    apiErrors: APIError[]
} {
    const errors: APIError[] = []
    const ids = inputs.map((_, index) => mainEntityIds[index])

    const failedActiveInputs = validateActiveEntityExists(
        ids,
        entityTypeName,
        entityMaps.mainEntity!
    )
    errors.push(...failedActiveInputs.values())

    const failedDuplicateInputs = validateNoDuplicate(ids, inputTypeName, 'id')
    errors.push(...failedDuplicateInputs.values())

    return filterInvalidInputs(inputs, [
        failedActiveInputs,
        failedDuplicateInputs,
    ])
}

/**
 * Filters out invalid inputs by removing those at the indices
 * where an error was detected.
 *
 * Returns the filtered input list, and the errors in the form
 * of a list.
 */
export function filterInvalidInputs<T>(
    inputs: T[],
    errorMaps: Map<number, APIError>[]
) {
    const validInputs = inputs
        .map((i, index) => {
            return { input: i, index }
        })
        .filter((_, index) => !errorMaps.some((em) => em.has(index)))
    const apiErrors = errorMaps.flatMap((em) => [...em.values()])
    return { validInputs, apiErrors }
}

export type ProcessedResult<
    OutputEntity extends CustomBaseEntity,
    ModifiedEntity extends CustomBaseEntity
> = {
    outputEntity: OutputEntity
    modifiedEntity?: ModifiedEntity[]
}

abstract class Mutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType,
    ModifiedEntityType extends CustomBaseEntity = EntityType
> {
    // Abstract variables
    protected abstract readonly EntityType: typeof CustomBaseEntity
    protected abstract readonly inputTypeName: string
    protected abstract readonly mainEntityIds: string[]
    protected abstract readonly output: OutputType

    // Concrete variables
    protected readonly input: InputType[]
    protected readonly permissions: Context['permissions']
    protected entityMaps?: EntityMap<EntityType>
    protected processedEntities: ModifiedEntityType[] = []

    protected constructor(
        input: InputType[],
        permissions: Context['permissions']
    ) {
        this.input = input
        this.permissions = permissions
    }

    // Abstract methods
    /**
     * Makes all db queries that are needed for this mutation,
     * and formats them into maps.
     * This should never under fetch data (and require later DB calls)
     * But may fetch more then is strictly needed
     * todo: can we make this lazy?
     */
    protected abstract generateEntityMaps(
        input: InputType[]
    ): Promise<EntityMap<EntityType>>

    /**
     * Standardises the format of the input if possible
     * Invalid input should be preserved so errors can be
     * generated for it during validation
     */
    protected normalize(inputs: InputType[]): InputType[] {
        return inputs
    }

    /**
     * Checks that the user calling the mutation has the
     * right permissions to perform all actions required by the mutation.
     */
    protected abstract authorize(
        input: InputType[],
        entityMaps: EntityMap<EntityType>
    ): Promise<void>

    /**
     * Looks for errors at one step of the input.
     *
     * TODO: should output the data that `process()` needs,
     * so we don't have to use maps and non-null assertions
     */
    protected abstract validate(
        index: number,
        currentEntity: EntityType | undefined,
        currentInput: InputType,
        entityMaps: EntityMap<EntityType>
    ): APIError[]

    /**
     * Produces the object to be saved to the database,
     * should also populate the output variable.
     */
    protected abstract process(
        currentInput: InputType,
        entityMaps: EntityMap<EntityType>,
        index: number
    ): ProcessedResult<EntityType, ModifiedEntityType>

    /**
     * Formats the current entity for output and pushes it the
     * list in `this.output`
     */
    protected abstract buildOutput(currentEntity?: EntityType): Promise<void>

    /**
     * Performs a save/update on the database.
     */
    protected abstract applyToDatabase(
        results: ProcessedResult<EntityType, ModifiedEntityType>[]
    ): Promise<void>

    private validateInputLength() {
        if (this.input.length < config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE) {
            throw createInputLengthAPIError(this.EntityType.name, 'min')
        }
        if (this.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE) {
            throw createInputLengthAPIError(this.EntityType.name, 'max')
        }
    }

    // Concrete Methods
    protected abstract validationOverAllInputs(
        inputs: InputType[],
        entityMaps: EntityMap<EntityType>
    ): {
        validInputs: { index: number; input: InputType }[]
        apiErrors: APIError[]
    }

    private inputLoop(
        normalizedInput: InputType[],
        entityMaps: EntityMap<EntityType>
    ): ProcessedResult<EntityType, ModifiedEntityType>[] {
        const errors: APIError[] = []
        const { validInputs, apiErrors } = this.validationOverAllInputs(
            normalizedInput,
            entityMaps
        )
        errors.push(...apiErrors)

        const processedEntities: ProcessedResult<
            EntityType,
            ModifiedEntityType
        >[] = []
        for (const { index, input } of validInputs) {
            let entity: EntityType | undefined = undefined
            if (entityMaps?.mainEntity !== undefined) {
                entity = entityMaps.mainEntity.get(this.mainEntityIds[index])!
            }

            errors.push(...this.validate(index, entity, input, entityMaps))
            if (errors.length) continue

            processedEntities.push(this.process(input, entityMaps, index))
        }
        if (errors.length) throw new APIErrorCollection(errors)
        return processedEntities
    }

    private async saveWrapper(
        results: ProcessedResult<EntityType, ModifiedEntityType>[]
    ) {
        try {
            await this.applyToDatabase(results)
        } catch (e) {
            let message = 'Unknown Error'
            if (e instanceof Error) {
                if (e.message) message = e.message
                else if (e.stack) message = e.stack.split('\n')[0]
            }
            throw createDatabaseSaveAPIError(this.EntityType.name, message)
        }
    }

    async run(): Promise<OutputType> {
        this.validateInputLength()
        const normalizedInput = this.normalize(this.input)
        const entityMaps = await this.generateEntityMaps(normalizedInput)
        await this.authorize(normalizedInput, entityMaps)
        const loopResults = this.inputLoop(normalizedInput, entityMaps)
        await this.saveWrapper(loopResults)
        // building output has to be done after saving to the DB
        // to allow DB generated default values to be returned
        // and null properties to be populated on partial objects
        for (const { outputEntity } of loopResults) {
            // eslint-disable-next-line no-await-in-loop
            await this.buildOutput(outputEntity)
        }
        return this.output
    }
}

export function mutate<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType,
    ModifiedEntityType extends CustomBaseEntity
>(
    mutation: new (
        argsInput: InputType[],
        perms: Context['permissions']
    ) => Mutation<EntityType, InputType, OutputType, ModifiedEntityType>,
    args: Record<'input', InputType[]>,
    permissions: Context['permissions']
): Promise<OutputType> {
    return new mutation(args.input, permissions).run()
}

export abstract class CreateMutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType
> extends Mutation<EntityType, InputType, OutputType> {
    protected mainEntityIds: string[] = []
    protected abstract buildOutput(outputEntity: EntityType): Promise<void>

    async applyToDatabase(
        results: Pick<ProcessedResult<EntityType, EntityType>, 'outputEntity'>[]
    ): Promise<void> {
        const allEntitiesToSave = []
        for (const result of results) {
            allEntitiesToSave.push(result.outputEntity)
        }
        await getManager().save(allEntitiesToSave)
    }
}

export abstract class UpdateMutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType
> extends Mutation<EntityType, InputType, OutputType> {
    constructor(input: InputType[], permissions: Context['permissions']) {
        super(input, permissions)
    }
    protected abstract buildOutput(currentEntity: EntityType): Promise<void>

    protected async applyToDatabase(
        results: Pick<ProcessedResult<EntityType, EntityType>, 'outputEntity'>[]
    ): Promise<void> {
        await getManager().save(results.map((r) => r.outputEntity))
    }
}

export interface DeleteEntityMap<EntityType extends CustomBaseEntity>
    extends EntityMap<EntityType> {
    mainEntity: Map<string, EntityType>
}

export abstract class DeleteMutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType
> extends Mutation<EntityType, InputType, OutputType> {
    private readonly partialEntity = {
        status: Status.INACTIVE,
        deleted_at: new Date(),
    }

    constructor(input: InputType[], permissions: Context['permissions']) {
        super(input, permissions)
    }

    protected validationOverAllInputs(
        inputs: InputType[],
        entityMaps: EntityMap<EntityType>
    ): {
        validInputs: { index: number; input: InputType }[]
        apiErrors: APIError[]
    } {
        return validateActiveAndNoDuplicates(
            inputs,
            entityMaps,
            this.mainEntityIds,
            this.EntityType.name,
            this.inputTypeName
        )
    }

    protected validate = () => []

    protected process(
        _currentInput: InputType,
        entityMaps: DeleteEntityMap<EntityType>,
        index: number
    ) {
        const currentEntity = entityMaps.mainEntity.get(
            this.mainEntityIds[index]
        )!
        Object.assign(currentEntity, this.partialEntity)
        return { outputEntity: currentEntity }
    }

    protected async applyToDatabase(): Promise<void> {
        await getManager()
            .createQueryBuilder()
            .update(this.EntityType)
            .set(this.partialEntity)
            .whereInIds(this.mainEntityIds)
            .execute()
    }
}

export abstract class AddRemoveMutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType,
    ModifiedEntityType extends CustomBaseEntity = EntityType
> extends Mutation<EntityType, InputType, OutputType, ModifiedEntityType> {
    constructor(input: InputType[], permissions: Context['permissions']) {
        super(input, permissions)
    }

    protected abstract process(
        currentInput: InputType,
        entityMaps: EntityMap<EntityType>,
        index: number
    ): Pick<ProcessedResult<EntityType, ModifiedEntityType>, 'outputEntity'>

    protected async applyToDatabase(
        results: ProcessedResult<EntityType, ModifiedEntityType>[]
    ): Promise<void> {
        await getManager().save(results.map((r) => r.outputEntity))
    }
}
export const AddMutation = AddRemoveMutation
export const RemoveMutation = AddRemoveMutation

/**
 * This abstract class is a variation on AddMutation for when
 * a mutation with a name like `AddXsFromYs` actually requires
 * creating a membership. These mutations
 * should be called `CreateYMemberships`, but we chose not to
 * give memberships (i.e. `OrganizationMembership` and
 * `SchoolMembership`) their own mutations.
 */
export const AddMembershipMutation = AddRemoveMutation

/**
 * This abstract class is a variation on RemoveMutation for when
 * a mutation with a name like `RemoveXsFromYs` actually requires
 * deleting a membership. These mutations
 * should be called `DeleteYMemberships`, but we chose not to
 * give memberships (i.e. `OrganizationMembership` and
 * `SchoolMembership`) their own mutations.
 */
export abstract class RemoveMembershipMutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType,
    MembershipType extends CustomBaseEntity
> extends Mutation<EntityType, InputType, OutputType, MembershipType> {
    protected readonly partialEntity = {
        status: Status.INACTIVE,
        deleted_at: new Date(),
    }
    protected abstract readonly MembershipType: typeof CustomBaseEntity

    constructor(input: InputType[], permissions: Context['permissions']) {
        super(input, permissions)
    }

    protected async applyToDatabase(
        results: ProcessedResult<EntityType, MembershipType>[]
    ): Promise<void> {
        await getManager()
            .createQueryBuilder()
            .update(this.MembershipType)
            .set(this.partialEntity)
            .whereInIds(results.map((r) => r.modifiedEntity ?? []).flat())
            .execute()
    }
}
