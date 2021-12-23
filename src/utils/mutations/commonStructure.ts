import { getManager } from 'typeorm'
import { config } from '../../config/config'
import { CustomBaseEntity } from '../../entities/customBaseEntity'
import { Status } from '../../entities/status'
import { Context } from '../../main'
import { APIError, APIErrorCollection } from '../../types/errors/apiError'
import {
    createDatabaseSaveAPIError,
    createDuplicateInputAPIError,
    createEntityAPIError,
    createInputLengthAPIError,
} from '../resolvers'

export type EntityMap<EntityType extends CustomBaseEntity> = {
    mainEntity: Map<string, EntityType>
    [key: string]: Map<string, CustomBaseEntity | CustomBaseEntity[]>
}

type InputLoopResults<OutputType> = {
    mutationOutput: OutputType
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
    protected readonly context: Pick<Context, 'permissions'>
    protected entityMaps?: EntityMap<EntityType>
    protected processedEntities: ModifiedEntityType[] = []

    protected constructor(
        input: InputType[],
        context: Pick<Context, 'permissions'>
    ) {
        this.input = input
        this.context = context
    }

    // Abstract methods
    /**
     * Makes all db queries that are needed for this mutation,
     * and formats them into maps.
     */
    protected abstract generateEntityMaps(
        input: InputType[]
    ): Promise<EntityMap<EntityType>>

    /**
     * Standardises the format of the input if possible, throws errors otherwise.
     */
    protected abstract normalize(input: InputType[]): Promise<InputType[]>

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
        currentEntity: EntityType | undefined,
        currentInput: InputType,
        entityMaps: EntityMap<EntityType>
    ): ModifiedEntityType[]

    /**
     * Formats the current entity for output and pushes it the
     * list in `this.output`
     */
    protected abstract buildOutput(currentEntity?: EntityType): void

    /**
     * Performs a save/update on the database.
     */
    protected abstract applyToDatabase(): Promise<void>

    private validateInputLength() {
        if (this.input.length < config.limits.MUTATION_MIN_INPUT_ARRAY_SIZE) {
            throw createInputLengthAPIError(this.EntityType.name, 'min')
        }
        if (this.input.length > config.limits.MUTATION_MAX_INPUT_ARRAY_SIZE) {
            throw createInputLengthAPIError(this.EntityType.name, 'max')
        }
    }

    // Concrete Methods
    private commonValidations(
        index: number,
        id: string,
        idsSet: Set<string>,
        entityMaps: EntityMap<EntityType>
    ): EntityType | APIError | undefined {
        // Check for duplicates
        if (idsSet.has(id)) {
            return createDuplicateInputAPIError(
                index,
                ['id'],
                this.inputTypeName
            )
        } else {
            idsSet.add(id)
        }

        if (this.inputTypeName.startsWith('Create')) return undefined

        const mainEntity = entityMaps.mainEntity.get(id)
        if (!mainEntity || mainEntity.status !== Status.ACTIVE) {
            return createEntityAPIError(
                'nonExistent',
                index,
                this.EntityType.name,
                id
            )
        }
        return mainEntity
    }

    private inputLoop(
        normalizedInput: InputType[],
        entityMaps: EntityMap<EntityType>
    ): InputLoopResults<OutputType> {
        const idsSet = new Set<string>()
        const errors: APIError[] = []
        for (const [index, entry] of normalizedInput.entries()) {
            // Validation stage
            const id = this.mainEntityIds[index]
            const entity = this.commonValidations(index, id, idsSet, entityMaps)
            if (entity instanceof APIError) {
                errors.push(entity)
                continue
            }
            errors.push(...this.validate(index, entity, entry, entityMaps))

            // Processing stage
            if (errors.length) continue
            this.processedEntities.push(
                ...this.process(entity, entry, entityMaps)
            )
            if (entity) this.buildOutput(entity)
        }
        if (errors.length) throw new APIErrorCollection(errors)
        return {
            mutationOutput: this.output,
        }
    }

    private async saveWrapper() {
        try {
            await this.applyToDatabase()
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
        const normalizedInput = await this.normalize(this.input)
        const entityMaps = await this.generateEntityMaps(this.input)
        await this.authorize(normalizedInput, entityMaps)
        const loopResults = this.inputLoop(normalizedInput, entityMaps)
        await this.saveWrapper()
        return loopResults.mutationOutput
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
        ctx: Pick<Context, 'permissions'>
    ) => Mutation<EntityType, InputType, OutputType, ModifiedEntityType>,
    args: Record<'input', InputType[]>,
    context: Pick<Context, 'permissions'>
): Promise<OutputType> {
    const mutationClass = new mutation(args.input, context)
    return mutationClass.run()
}

export abstract class CreateMutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType
> extends Mutation<EntityType, InputType, OutputType> {
    protected normalize = () => Promise.resolve(this.input)
    protected abstract buildOutput(): Promise<void>

    protected async applyToDatabase(): Promise<void> {
        await getManager().save(this.processedEntities)
        await this.buildOutput()
    }
}

export abstract class UpdateMutation<
    EntityType extends CustomBaseEntity,
    InputType,
    OutputType
> extends Mutation<EntityType, InputType, OutputType> {
    abstract normalize = () => Promise.resolve(this.input)

    protected async applyToDatabase(): Promise<void> {
        await getManager().save(this.processedEntities)
    }
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

    constructor(input: InputType[], context: Pick<Context, 'permissions'>) {
        super(input, context)
    }

    protected normalize = () => Promise.resolve(this.input)
    protected validate = () => []

    protected process(currentEntity: EntityType): EntityType[] {
        Object.assign(currentEntity, this.partialEntity)
        return [currentEntity]
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
    constructor(input: InputType[], context: Pick<Context, 'permissions'>) {
        super(input, context)
    }

    protected normalize = () => Promise.resolve(this.input)

    protected async applyToDatabase(): Promise<void> {
        await getManager().save(this.processedEntities)
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
    protected abstract readonly saveIds: Record<string, string>[]

    constructor(input: InputType[], context: Pick<Context, 'permissions'>) {
        super(input, context)
    }

    protected normalize = () => Promise.resolve(this.input)

    protected async applyToDatabase(): Promise<void> {
        await getManager()
            .createQueryBuilder()
            .update(this.MembershipType)
            .set(this.partialEntity)
            .whereInIds(this.saveIds)
            .execute()
    }
}
