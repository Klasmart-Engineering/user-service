import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Role } from '../entities/role'
import { User } from '../entities/user'
import { Context } from '../main'
import { mapOrganizationToOrganizationConnectionNode } from '../pagination/organizationsConnection'
import { PermissionName } from '../permissions/permissionNames'
import { APIError } from '../types/errors/apiError'
import {
    AddUsersToOrganizationInput,
    CreateOrganizationInput,
    DeleteOrganizationInput,
    OrganizationsMutationResult,
    UpdateOrganizationInput,
} from '../types/graphQL/organization'
import {
    createApplyingChangeToSelfAPIError,
    createExistentEntityAttributeAPIError,
    createUserAlreadyOwnsOrgAPIError,
} from '../utils/resolvers/errors'
import { config } from '../config/config'
import {
    formatShortCode,
    generateShortCode,
    newValidateShortCode,
    validateShortCode,
} from '../utils/shortcode'
import {
    RemoveMembershipMutation,
    EntityMap,
    AddMembershipMutation,
    ProcessedResult,
    validateActiveAndNoDuplicates,
    filterInvalidInputs,
    CreateMutation,
    validateNoDuplicate,
    validateNoDuplicates,
    validateSubItemsLengthAndNoDuplicates,
    DeleteMutation,
    validateAtLeastOne,
    validateHexadecimalColor,
    validateImageUpload,
    GenericMutation,
} from '../utils/resolvers/commonStructure'
import { getMap } from '../utils/resolvers/entityMaps'
import {
    flagExistentOrganizationMembership,
    flagNonExistent,
    flagNonExistentChild,
    flagNonExistentOrganizationMembership,
} from '../utils/resolvers/inputValidation'
import clean, { uniqueAndTruthy } from '../utils/clean'
import { ObjMap } from '../utils/stringUtils'
import { OrganizationOwnership } from '../entities/organizationOwnership'
import { v4 as uuid_v4 } from 'uuid'
import { getManager, In, IsNull } from 'typeorm'
import { Status } from '../entities/status'
import logger from '../logging'
import { Branding } from '../entities/branding'
import { FileUpload } from 'graphql-upload'
import { BrandingImageTag } from '../types/graphQL/branding'
import { BrandingImage } from '../entities/brandingImage'
import { buildFilePath } from '../utils/storage'
import { CloudStorageUploader } from '../services/cloudStorageUploader'

interface UserAndMemberships extends User {
    __memberships__: OrganizationMembership[]
}
export interface EntityMapCreateOrganization extends EntityMap<Organization> {
    users: Map<string, User>
    conflictingNameOrgIds: ObjMap<{ name: string }, string>
    conflictingShortcodeOrgIds: ObjMap<{ shortcode: string }, string>
    userOwnedOrg: ObjMap<{ userId: string }, string>
    adminRole: Role
}

export interface EntityMapUpdateOrganization extends EntityMap<Organization> {
    mainEntity: Map<string, Organization>
    primaryContacts: Map<string, User>
    conflictingNameOrgIds: ObjMap<{ name: string }, string>
    conflictingShortcodeOrgIds: ObjMap<{ shortcode: string }, string>
    organizationBranding: Map<string, Branding>
    iconImagesToUpload: Map<string, FileUpload>
    iconImagesURLs: ObjMap<{ organizationId: string; tag: string }, string>
}

export class CreateOrganizations extends CreateMutation<
    Organization,
    CreateOrganizationInput,
    OrganizationsMutationResult,
    EntityMapCreateOrganization,
    OrganizationOwnership | OrganizationMembership
> {
    protected readonly EntityType = Organization
    protected inputTypeName = 'CreateOrganizationInput'
    protected output: OrganizationsMutationResult = { organizations: [] }

    normalize(input: CreateOrganizationInput[]) {
        for (const inputElement of input) {
            if (inputElement.shortcode === undefined) {
                inputElement.shortcode = generateShortCode()
            } else {
                inputElement.shortcode = clean.shortcode(inputElement.shortcode)
            }
        }
        return input
    }

    async generateEntityMaps(
        input: CreateOrganizationInput[]
    ): Promise<EntityMapCreateOrganization> {
        const usersMap = getMap.user(
            input.map((i) => i.userId),
            ['organization_ownerships']
        )

        const names = input.map(({ organizationName }) => organizationName)
        const conflictingNameOrgIdsMap = Organization.find({
            select: ['organization_id', 'organization_name'],
            where: { organization_name: In(names) },
        }).then(
            (res) =>
                new ObjMap(
                    res.map((r) => {
                        return {
                            key: { name: r.organization_name! },
                            value: r.organization_id,
                        }
                    })
                )
        )

        const validShortcodes = input
            .map(({ shortcode }) => shortcode)
            .filter((shortcode) => validateShortCode(shortcode))
        const conflictingShortcodeOrgIdsMap = Organization.find({
            select: ['organization_id', 'shortCode'],
            where: { shortCode: In(validShortcodes) },
        }).then(
            (res) =>
                new ObjMap(
                    res.map((r) => {
                        return {
                            key: { shortcode: r.shortCode! },
                            value: r.organization_id,
                        }
                    })
                )
        )

        const adminRole = Role.findOneOrFail({
            where: {
                role_name: 'Organization Admin',
                system_role: true,
                organization: IsNull(),
                status: Status.ACTIVE,
            },
        })

        const userOwnedOrgMap = new ObjMap<{ userId: string }, string>()
        for (const [userId, user] of (await usersMap).entries()) {
            // eslint-disable-next-line no-await-in-loop
            const ownerships = await user.organization_ownerships
            for (const { organization_id } of ownerships || []) {
                userOwnedOrgMap.set({ userId }, organization_id)
            }
        }

        return {
            users: await usersMap,
            conflictingNameOrgIds: await conflictingNameOrgIdsMap,
            conflictingShortcodeOrgIds: await conflictingShortcodeOrgIdsMap,
            userOwnedOrg: userOwnedOrgMap,
            adminRole: await adminRole,
        }
    }

    async authorize(): Promise<void> {
        this.permissions.rejectIfNotAdmin()
    }

    validationOverAllInputs(inputs: CreateOrganizationInput[]) {
        const duplicateUserErrors = validateNoDuplicate(
            inputs.map((i) => i.userId),
            'CreateOrganizationInput',
            ['userId']
        ) // user can only be the owner of one organization
        const duplicateNameErrors = validateNoDuplicate(
            inputs.map((i) => i.organizationName),
            'CreateOrganizationInput',
            ['organizationName']
        )
        const duplicateShortcodeErrors = validateNoDuplicate(
            inputs.map((i) => i.shortcode!),
            'CreateOrganizationInput',
            ['shortcode']
        )
        return filterInvalidInputs(inputs, [
            duplicateUserErrors,
            duplicateNameErrors,
            duplicateShortcodeErrors,
        ])
    }

    validate(
        index: number,
        _: undefined,
        currentInput: CreateOrganizationInput,
        maps: EntityMapCreateOrganization
    ): APIError[] {
        const errors: APIError[] = []
        const { userId, organizationName, shortcode } = currentInput

        const users = flagNonExistent(User, index, [userId], maps.users)
        errors.push(...users.errors)

        const conflictingNameOrgId = maps.conflictingNameOrgIds?.get({
            name: organizationName,
        })
        if (conflictingNameOrgId) {
            errors.push(
                createExistentEntityAttributeAPIError(
                    'Organization',
                    conflictingNameOrgId,
                    'name',
                    organizationName,
                    index
                )
            )
        }

        if (shortcode) {
            const conflictingShortcodeOrgId = maps.conflictingShortcodeOrgIds?.get(
                { shortcode: shortcode }
            )
            if (conflictingShortcodeOrgId) {
                errors.push(
                    createExistentEntityAttributeAPIError(
                        'Organization',
                        conflictingShortcodeOrgId,
                        'shortcode',
                        shortcode,
                        index
                    )
                )
            }
        }

        const shortCodeErrors = newValidateShortCode(
            'Organization',
            shortcode,
            index
        )
        errors.push(...shortCodeErrors)

        const conflictingUserOrgId = maps.userOwnedOrg.get({ userId })
        if (conflictingUserOrgId) {
            errors.push(
                createUserAlreadyOwnsOrgAPIError(
                    userId,
                    conflictingUserOrgId,
                    index
                )
            )
        }

        return errors
    }

    process(
        currentInput: CreateOrganizationInput,
        maps: EntityMapCreateOrganization
    ): {
        outputEntity: Organization
        modifiedEntity: (OrganizationMembership | OrganizationOwnership)[]
    } {
        const {
            userId,
            organizationName,
            address1,
            address2,
            phone,
            shortcode,
        } = currentInput
        const userPromise = Promise.resolve(maps.users.get(userId)!)
        const outputEntity = new Organization()
        outputEntity.organization_id = uuid_v4()
        outputEntity.organization_name = organizationName
        outputEntity.address1 = address1
        outputEntity.address2 = address2
        outputEntity.phone = phone
        outputEntity.shortCode = shortcode
        outputEntity.primary_contact = userPromise

        const orgMembership = new OrganizationMembership()
        orgMembership.user = userPromise
        orgMembership.user_id = userId
        orgMembership.organization = Promise.resolve(outputEntity)
        orgMembership.organization_id = outputEntity.organization_id
        orgMembership.roles = Promise.resolve([maps.adminRole])
        outputEntity.memberships = Promise.resolve([orgMembership])

        const orgOwnership = new OrganizationOwnership()
        orgOwnership.user_id = userId
        orgOwnership.organization_id = outputEntity.organization_id

        return { outputEntity, modifiedEntity: [orgMembership, orgOwnership] }
    }

    async buildOutput(outputEntity: Organization): Promise<void> {
        this.output.organizations.push(
            mapOrganizationToOrganizationConnectionNode(outputEntity)
        )
    }
}

export class UpdateOrganizations extends GenericMutation<
    Organization,
    UpdateOrganizationInput,
    OrganizationsMutationResult,
    EntityMapUpdateOrganization,
    Branding
> {
    protected readonly EntityType = Organization
    protected inputTypeName = 'UpdateOrganizationInput'
    protected mainEntityIds: string[] = []
    protected output: OrganizationsMutationResult = { organizations: [] }

    constructor(
        input: UpdateOrganizationInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    normalize(input: UpdateOrganizationInput[]) {
        for (const inputElement of input) {
            if (inputElement.shortcode) {
                inputElement.shortcode = clean.shortcode(inputElement.shortcode)
            }
        }
        return input
    }

    async generateEntityMaps(
        input: UpdateOrganizationInput[]
    ): Promise<EntityMapUpdateOrganization> {
        const ids: string[] = []
        const names: string[] = []
        const validShortcodes: string[] = []
        const primaryContactIds: string[] = []
        const orgIdsForBrandings: string[] = []
        const iconImagesToUpload = new Map<string, FileUpload>()
        const iconImagesURLs = new ObjMap<
            { organizationId: string; tag: string },
            string
        >()

        for await (const i of input) {
            ids.push(i.id)
            if (i.organizationName) names.push(i.organizationName)
            if (i.shortcode && validateShortCode(i.shortcode))
                validShortcodes.push(i.shortcode)
            if (i.primaryContactId) primaryContactIds.push(i.primaryContactId)
            if (i.branding) {
                orgIdsForBrandings.push(i.id)
                const image = await i.branding.iconImage
                if (image) {
                    iconImagesToUpload.set(i.id, image.file)
                    const imageInfo = await uploadImagesAndGetURL(
                        i.id,
                        image.file
                    )

                    for (const [tag, url] of imageInfo.entries()) {
                        iconImagesURLs.set({ organizationId: i.id, tag }, url)
                    }
                }
            }
        }

        const organizations = getMap.organization(ids)
        const primaryContacts = getMap.user(primaryContactIds, ['memberships'])

        const conflictingNameOrgIdsMap = Organization.find({
            select: ['organization_id', 'organization_name'],
            where: { organization_name: In(names) },
        }).then(
            (res) =>
                new ObjMap(
                    res.map((r) => {
                        return {
                            key: { name: r.organization_name! },
                            value: r.organization_id,
                        }
                    })
                )
        )

        const conflictingShortcodeOrgIdsMap = Organization.find({
            select: ['organization_id', 'shortCode'],
            where: { shortCode: In(validShortcodes) },
        }).then(
            (res) =>
                new ObjMap(
                    res.map((r) => {
                        return {
                            key: { shortcode: r.shortCode! },
                            value: r.organization_id,
                        }
                    })
                )
        )

        const organizationBrandingMap = new Map<string, Branding>()
        const organizationBranding = Branding.find({
            where: {
                organization: {
                    organization_id: In(orgIdsForBrandings),
                },
                status: Status.ACTIVE,
            },
            relations: ['organization'],
        })

        for await (const branding of await organizationBranding) {
            const orgId = (await branding.organization)!.organization_id
            organizationBrandingMap.set(orgId, branding)
        }

        return {
            mainEntity: await organizations,
            conflictingNameOrgIds: await conflictingNameOrgIdsMap,
            conflictingShortcodeOrgIds: await conflictingShortcodeOrgIdsMap,
            primaryContacts: await primaryContacts,
            organizationBranding: organizationBrandingMap,
            iconImagesToUpload,
            iconImagesURLs,
        }
    }

    async authorize() {
        await this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.edit_my_organization_10331
        )
    }

    validationOverAllInputs(
        inputs: UpdateOrganizationInput[],
        maps: EntityMapUpdateOrganization
    ): {
        validInputs: { index: number; input: UpdateOrganizationInput }[]
        apiErrors: APIError[]
    } {
        const failedAtLeastOne = validateAtLeastOne(inputs, 'Organization', [
            'organizationName',
            'address1',
            'address2',
            'phone',
            'shortcode',
            'primaryContactId',
            'branding',
        ])
        const duplicateIdErrors = validateNoDuplicate(
            inputs.map((i) => i.id),
            'UpdateOrganizationInput',
            ['id']
        )
        const duplicateNameErrors = validateNoDuplicate(
            inputs
                .filter((i) => i.organizationName)
                .map((i) => i.organizationName!),
            'UpdateOrganizationInput',
            ['organizationName']
        )
        const duplicateShortcodeErrors = validateNoDuplicate(
            inputs.filter((i) => i.shortcode).map((i) => i.shortcode!),
            'UpdateOrganizationInput',
            ['shortcode']
        )
        const hexadecimalColorErrors = validateHexadecimalColor(
            inputs.map((i) => i.branding?.primaryColor),
            'UpdateOrganizationInput',
            'branding.primaryColor'
        )
        const imageMimetypeErrors = validateImageUpload(
            inputs.map((i) => maps.iconImagesToUpload.get(i.id)),
            'UpdateOrganizationInput',
            'branding.iconImage'
        )

        return filterInvalidInputs(inputs, [
            failedAtLeastOne,
            duplicateIdErrors,
            duplicateNameErrors,
            duplicateShortcodeErrors,
            hexadecimalColorErrors,
            imageMimetypeErrors,
        ])
    }

    validate(
        index: number,
        currentOrg: Organization,
        currentInput: UpdateOrganizationInput,
        maps: EntityMapUpdateOrganization
    ): APIError[] {
        const errors: APIError[] = []
        const {
            id,
            organizationName,
            shortcode,
            primaryContactId,
        } = currentInput

        const organization = flagNonExistent(
            Organization,
            index,
            [id],
            maps.mainEntity!
        )
        errors.push(...organization.errors)

        if (organizationName) {
            const conflictingNameOrgId = maps.conflictingNameOrgIds?.get({
                name: organizationName,
            })

            if (conflictingNameOrgId && conflictingNameOrgId !== id) {
                errors.push(
                    createExistentEntityAttributeAPIError(
                        'Organization',
                        conflictingNameOrgId,
                        'name',
                        organizationName,
                        index
                    )
                )
            }
        }

        if (shortcode) {
            const conflictingShortcodeOrgId = maps.conflictingShortcodeOrgIds?.get(
                { shortcode: shortcode }
            )

            if (conflictingShortcodeOrgId && conflictingShortcodeOrgId !== id) {
                errors.push(
                    createExistentEntityAttributeAPIError(
                        'Organization',
                        conflictingShortcodeOrgId,
                        'shortcode',
                        shortcode,
                        index
                    )
                )
            }

            const shortCodeErrors = newValidateShortCode(
                'Organization',
                shortcode,
                index
            )

            errors.push(...shortCodeErrors)
        }

        if (primaryContactId) {
            const primaryContact = flagNonExistent(
                User,
                index,
                [primaryContactId],
                maps.primaryContacts
            )

            errors.push(...primaryContact.errors)

            if (!primaryContact.values.length) return errors

            const contactMemberships = (primaryContact
                .values[0] as UserAndMemberships).__memberships__
            const organizationIds = new Set(
                contactMemberships.map((cm) => cm.organization_id)
            )

            const primaryContactInOrgErrors = flagNonExistentChild(
                User,
                Organization,
                index,
                primaryContactId,
                [id],
                organizationIds
            )

            errors.push(...primaryContactInOrgErrors)
        }

        return errors
    }

    protected process(
        currentInput: UpdateOrganizationInput,
        maps: EntityMapUpdateOrganization
    ): ProcessedResult<Organization, Branding> {
        const {
            id,
            organizationName,
            address1,
            address2,
            phone,
            shortcode,
            primaryContactId,
            branding,
        } = currentInput

        const organization = maps.mainEntity.get(id)!

        organization.organization_name =
            organizationName || organization.organization_name
        organization.address1 = address1 || organization.address1
        organization.address2 = address2 || organization.address2
        organization.phone = phone || organization.phone
        organization.shortCode = shortcode || organization.shortCode

        if (primaryContactId) {
            const primaryContactUser = maps.primaryContacts.get(
                primaryContactId
            )!

            organization.primary_contact = Promise.resolve(primaryContactUser)
        }

        let orgBranding: Branding | undefined
        if (branding) {
            orgBranding = maps.organizationBranding.get(id)

            if (!orgBranding) {
                orgBranding = new Branding()
                orgBranding.organization = Promise.resolve(organization)
            }

            orgBranding.primaryColor =
                branding.primaryColor || orgBranding.primaryColor

            const imageIcon = maps.iconImagesToUpload.get(id)
            if (imageIcon) {
                const existentImages = orgBranding.images

                if (existentImages) {
                    for (const existentImage of existentImages.values()) {
                        existentImage.status = Status.INACTIVE
                    }
                }

                const newImages = Object.values(BrandingImageTag).map((tag) => {
                    const newImage = new BrandingImage()
                    newImage.branding = orgBranding
                    newImage.tag = tag
                    newImage.url = maps.iconImagesURLs.get({
                        organizationId: id,
                        tag,
                    })

                    return newImage
                })

                orgBranding.images?.push(...newImages)
            }
        }

        const result: ProcessedResult<Organization, Branding> = {
            outputEntity: organization,
        }

        if (orgBranding) result.modifiedEntity = [orgBranding]

        return result
    }

    protected async applyToDatabase(
        results: ProcessedResult<Organization, Branding>[]
    ): Promise<void> {
        await Organization.save(results.map((r) => r.outputEntity))
        const brandings = results
            .map((r) => r.modifiedEntity)
            .flat()
            .filter((m) => m !== undefined) as Branding[]

        const brandingImages = uniqueAndTruthy(
            brandings.flatMap((b) => b.images)
        )

        await BrandingImage.save(brandingImages)
        await Branding.save(brandings)
    }

    protected async buildOutput(
        outputOrganization: Organization
    ): Promise<void> {
        const organizationConnectionNode = mapOrganizationToOrganizationConnectionNode(
            outputOrganization
        )

        this.output.organizations.push(organizationConnectionNode)
    }
}

export interface ChangeOrganizationMembershipStatusEntityMap
    extends EntityMap<Organization> {
    mainEntity: Map<string, Organization>
    users: Map<string, User>
    memberships: ObjMap<
        { organizationId: string; userId: string },
        OrganizationMembership
    >
}
interface AddUsersToOrganizationsEntityMap
    extends ChangeOrganizationMembershipStatusEntityMap {
    roles: Map<string, Role>
}

export class AddUsersToOrganizations extends AddMembershipMutation<
    Organization,
    AddUsersToOrganizationInput,
    OrganizationsMutationResult,
    AddUsersToOrganizationsEntityMap,
    OrganizationMembership
> {
    protected readonly EntityType = Organization
    protected inputTypeName = 'AddUsersToOrganizationInput'
    protected output: OrganizationsMutationResult = { organizations: [] }
    protected mainEntityIds: string[]

    constructor(
        input: AddUsersToOrganizationInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.organizationId)
    }

    generateEntityMaps(
        input: AddUsersToOrganizationInput[]
    ): Promise<AddUsersToOrganizationsEntityMap> {
        return generateAddRemoveOrgUsersMap(this.mainEntityIds, input)
    }

    protected authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.send_invitation_40882
        )
    }

    protected validationOverAllInputs(
        inputs: AddUsersToOrganizationInput[],
        entityMaps: AddUsersToOrganizationsEntityMap
    ): {
        validInputs: { index: number; input: AddUsersToOrganizationInput }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(
            inputs,
            validateActiveAndNoDuplicates(
                inputs,
                entityMaps,
                inputs.map((val) => val.organizationId),
                this.EntityType.name,
                this.inputTypeName,
                'organizationId'
            )
        )
    }

    protected validate(
        index: number,
        _currentEntity: Organization,
        currentInput: AddUsersToOrganizationInput,
        maps: AddUsersToOrganizationsEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, organizationRoleIds, userIds } = currentInput

        const users = flagNonExistent(User, index, userIds, maps.users)
        errors.push(...users.errors)

        const roles = flagNonExistent(
            Role,
            index,
            organizationRoleIds,
            maps.roles
        )
        errors.push(...roles.errors)

        if (!users.values.length) return errors
        const memberships = flagExistentOrganizationMembership(
            index,
            organizationId,
            users.values.map((u) => u.user_id),
            maps.memberships
        )
        errors.push(...memberships.errors)

        return errors
    }

    protected process(
        currentInput: AddUsersToOrganizationInput,
        maps: AddUsersToOrganizationsEntityMap,
        index: number
    ): ProcessedResult<Organization, OrganizationMembership> {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!

        // Retrieval
        const { organizationId, organizationRoleIds, userIds } = currentInput
        const roles = organizationRoleIds.map(
            (ori) => maps.roles.get(ori) as Role
        )
        const shortcode = formatShortCode(currentInput.shortcode)

        // Create new memberships in organisation
        const memberships: OrganizationMembership[] = []
        const statusUpdatedAt = new Date()
        for (const userId of userIds) {
            const user = maps.users.get(userId) as User
            const membership = new OrganizationMembership()
            membership.organization_id = organizationId
            membership.roles = Promise.resolve(roles)
            membership.organization = Promise.resolve(currentEntity)
            membership.user_id = userId
            membership.user = Promise.resolve(user)
            membership.shortcode =
                shortcode ||
                generateShortCode(userId, config.limits.SHORTCODE_MAX_LENGTH)
            membership.status_updated_at = statusUpdatedAt
            memberships.push(membership)
        }
        return { outputEntity: currentEntity, modifiedEntity: memberships }
    }

    protected buildOutput = async (
        currentEntity: Organization
    ): Promise<void> => addOrgToOutput(currentEntity, this.output)

    protected async applyToDatabase(
        results: ProcessedResult<Organization, OrganizationMembership>[]
    ) {
        await super.applyToDatabase(results)
        for (const result of results) {
            logger.info(
                `${this.permissions.getUserId()} added users ${result.modifiedEntity?.map(
                    (m) => m.user_id
                )} to organization ${result.outputEntity.organization_id}`
            )
        }
    }
}

export abstract class ChangeOrganizationMembershipStatus extends RemoveMembershipMutation<
    Organization,
    { organizationId: string; userIds: string[] },
    OrganizationsMutationResult,
    ChangeOrganizationMembershipStatusEntityMap,
    OrganizationMembership
> {
    protected readonly EntityType = Organization
    protected readonly MembershipType = OrganizationMembership
    protected output: OrganizationsMutationResult = { organizations: [] }
    protected mainEntityIds: string[]

    constructor(
        input: { organizationId: string; userIds: string[] }[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.organizationId)
    }

    abstract generateEntityMaps(
        input: { organizationId: string; userIds: string[] }[]
    ): Promise<ChangeOrganizationMembershipStatusEntityMap>

    abstract authorize(): Promise<void>

    validationOverAllInputs(
        inputs: { organizationId: string; userIds: string[] }[]
    ): {
        validInputs: {
            index: number
            input: { organizationId: string; userIds: string[] }
        }[]
        apiErrors: APIError[]
    } {
        return filterInvalidInputs(inputs, [
            ...validateNoDuplicates(
                inputs,
                inputs.map((val) => val.organizationId),
                this.inputTypeName
            ),
            ...validateSubItemsLengthAndNoDuplicates(
                inputs,
                this.inputTypeName,
                'userIds'
            ),
        ])
    }

    validate(
        index: number,
        _currentEntity: Organization,
        currentInput: { organizationId: string; userIds: string[] },
        maps: ChangeOrganizationMembershipStatusEntityMap
    ): APIError[] {
        const errors: APIError[] = []
        const { organizationId, userIds } = currentInput

        const clientUserId = this.permissions.getUserId()

        // if clientUserId is undefined, this is being called as a service-to-service request
        // as permissions checks would of already failed otherwise
        if (clientUserId && userIds.find((userId) => userId === clientUserId)) {
            errors.push(createApplyingChangeToSelfAPIError(clientUserId, index))
        }

        const users = flagNonExistent(User, index, userIds, maps.users)
        errors.push(...users.errors)

        if (!users.values.length) return errors
        const memberships = flagNonExistentOrganizationMembership(
            index,
            organizationId,
            users.values.map((u) => u.user_id),
            maps.memberships
        )
        errors.push(...memberships.errors)

        return errors
    }

    process(
        currentInput: { organizationId: string; userIds: string[] },
        maps: ChangeOrganizationMembershipStatusEntityMap,
        index: number
    ): {
        outputEntity: Organization
        modifiedEntity: OrganizationMembership[]
    } {
        const currentEntity = maps.mainEntity.get(this.mainEntityIds[index])!
        const { organizationId, userIds } = currentInput
        const memberships: OrganizationMembership[] = []
        for (const userId of userIds) {
            const membership = maps.memberships.get({ organizationId, userId })!
            Object.assign(membership, this.partialEntity)
            memberships.push(membership)
        }

        return { outputEntity: currentEntity, modifiedEntity: memberships }
    }

    protected async applyToDatabase(
        results: ProcessedResult<Organization, OrganizationMembership>[]
    ) {
        await super.applyToDatabase(results)
        for (const result of results) {
            logger.info(
                `${
                    this.inputTypeName
                }: ${this.permissions.getUserId()} on users ${result.modifiedEntity?.map(
                    (m) => m.user_id
                )} of organization ${result.outputEntity.organization_id}`
            )
        }
    }

    protected async buildOutput(currentEntity: Organization): Promise<void> {
        return addOrgToOutput(currentEntity, this.output)
    }
}

export class ReactivateUsersFromOrganizations extends ChangeOrganizationMembershipStatus {
    protected inputTypeName = 'reactivateUsersFromOrganizationInput'
    protected readonly partialEntity = {
        status: Status.ACTIVE,
        status_updated_at: new Date(),
    }

    authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.reactivate_user_40884
        )
    }

    generateEntityMaps(
        input: { organizationId: string; userIds: string[] }[]
    ): Promise<ChangeOrganizationMembershipStatusEntityMap> {
        return generateAddRemoveOrgUsersMap(this.mainEntityIds, input, [
            Status.INACTIVE,
        ])
    }
}

export class RemoveUsersFromOrganizations extends ChangeOrganizationMembershipStatus {
    protected inputTypeName = 'RemoveUsersFromOrganizationInput'
    protected readonly partialEntity = {
        status: Status.INACTIVE,
        status_updated_at: new Date(),
    }
    authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.deactivate_user_40883
        )
    }

    generateEntityMaps(
        input: { organizationId: string; userIds: string[] }[]
    ): Promise<ChangeOrganizationMembershipStatusEntityMap> {
        return generateAddRemoveOrgUsersMap(this.mainEntityIds, input, [
            Status.ACTIVE,
        ])
    }
}

export class DeleteUsersFromOrganizations extends ChangeOrganizationMembershipStatus {
    protected inputTypeName = 'deleteUsersFromOrganizationInput'
    protected readonly partialEntity = {
        status: Status.DELETED,
        status_updated_at: new Date(),
    }
    authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.delete_users_40440
        )
    }

    generateEntityMaps(
        input: { organizationId: string; userIds: string[] }[]
    ): Promise<ChangeOrganizationMembershipStatusEntityMap> {
        return generateAddRemoveOrgUsersMap(this.mainEntityIds, input, [
            Status.ACTIVE,
            Status.INACTIVE,
        ])
    }
}

export interface DeleteOrganizationsEntityMap extends EntityMap<Organization> {
    mainEntity: Map<string, Organization>
    memberships: OrganizationMembership[]
}

export class DeleteOrganizations extends DeleteMutation<
    Organization,
    DeleteOrganizationInput,
    OrganizationsMutationResult
> {
    protected readonly EntityType = Organization
    protected readonly inputTypeName = 'DeleteOrganizationInput'
    protected readonly output: OrganizationsMutationResult = {
        organizations: [],
    }
    protected readonly mainEntityIds: string[]

    constructor(
        input: DeleteOrganizationInput[],
        permissions: Context['permissions']
    ) {
        super(input, permissions)
        this.mainEntityIds = input.map((val) => val.id)
    }

    async generateEntityMaps(): Promise<DeleteOrganizationsEntityMap> {
        const organizations = await getMap.organization(this.mainEntityIds, [
            'memberships',
        ])
        const memberships = new Set<OrganizationMembership>()
        for (const organization of organizations.values()) {
            if (organization.memberships) {
                // eslint-disable-next-line no-await-in-loop
                for (const membership of await organization.memberships) {
                    memberships.add(membership)
                }
            }
        }
        return {
            mainEntity: organizations,
            memberships: Array.from(memberships),
        }
    }

    async authorize(): Promise<void> {
        return this.permissions.rejectIfNotAllowed(
            { organization_ids: this.mainEntityIds },
            PermissionName.delete_organization_10440
        )
    }

    async buildOutput(organization: Organization): Promise<void> {
        this.output.organizations.push(
            mapOrganizationToOrganizationConnectionNode(organization)
        )
    }

    async applyToDatabase(): Promise<void> {
        await getManager().transaction(async (manager) => {
            if (this.entityMaps) {
                const membershipIds = (this.entityMaps
                    .memberships as OrganizationMembership[]).map(
                    ({ user_id, organization_id }) => ({
                        user_id,
                        organization_id,
                    })
                )
                await manager
                    .createQueryBuilder()
                    .update(OrganizationMembership)
                    .set(this.partialEntity)
                    .whereInIds(membershipIds)
                    .execute()
            }
            await manager
                .createQueryBuilder()
                .update(this.EntityType)
                .set(this.partialEntity)
                .whereInIds(this.mainEntityIds)
                .execute()
        })
    }
}

export async function generateAddRemoveOrgUsersMap(
    organizationIds: string[],
    input: {
        userIds: string[]
        organizationRoleIds?: string[]
    }[],
    organizationMembershipStatus = [Status.ACTIVE]
): Promise<AddUsersToOrganizationsEntityMap> {
    const orgMap = getMap.organization(organizationIds)
    const userMap = getMap.user(input.flatMap((i) => i.userIds))

    const orgRoleIds = input
        .flatMap((i) => i.organizationRoleIds)
        .filter((rid): rid is string => rid !== undefined)
    const roleMap = getMap.role(orgRoleIds)

    const membershipMap = getMap.membership.organization(
        organizationIds,
        input.flatMap((i) => i.userIds),
        undefined,
        organizationMembershipStatus
    )

    return {
        mainEntity: await orgMap,
        users: await userMap,
        roles: await roleMap,
        memberships: await membershipMap,
    }
}

function addOrgToOutput(
    organization: Organization,
    output: OrganizationsMutationResult
): void {
    output.organizations.push(
        mapOrganizationToOrganizationConnectionNode(organization)
    )
}

async function uploadImagesAndGetURL(organizationId: string, file: FileUpload) {
    const brandingImagesInfo = new Map<string, string>()
    for await (const tag of Object.values(BrandingImageTag)) {
        // Build path for image
        const remoteFilePath = buildFilePath(
            organizationId,
            file.filename,
            'organizations',
            tag.toLowerCase()
        )

        // Upload image to cloud
        const remoteUrl = await CloudStorageUploader.call(
            file.createReadStream(),
            remoteFilePath
        )

        //Safe info for saving later on DB
        if (remoteUrl) {
            brandingImagesInfo.set(tag, remoteUrl)
        }
    }

    return brandingImagesInfo
}
