import { EntityManager } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'
import { accountUUID, User } from '../../entities/user'
import { OrganizationRow } from '../../types/csv/organizationRow'
import { generateShortCode, validateShortCode } from '../shortcode'
import { Organization } from '../../entities/organization'
import { OrganizationMembership } from '../../entities/organizationMembership'
import { OrganizationOwnership } from '../../entities/organizationOwnership'
import { Role } from '../../entities/role'
import { Status } from '../../entities/status'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { UserPermissions } from '../../permissions/userPermissions'
import { normalizedLowercaseTrimmed } from '../../utils/clean'
import { config } from '../../config/config'

async function getUserByEmailOrPhone(
    manager: EntityManager,
    email?: string,
    phone?: string
) {
    const hashSource = email || phone
    const user_id = accountUUID(hashSource)
    return manager.findOne(User, { user_id })
}

async function createOrganizationOwner(
    given_name?: string,
    family_name?: string,
    email?: string,
    phone?: string
) {
    const hashSource = email ?? phone
    const user_id = accountUUID(hashSource)
    const owner = new User()

    if (email) {
        email = normalizedLowercaseTrimmed(email)
    }

    if (phone) {
        phone = normalizedLowercaseTrimmed(phone)
    }

    owner.user_id = user_id
    owner.email = email
    owner.phone = phone
    owner.given_name = given_name
    owner.family_name = family_name

    return owner
}

async function createOrganization(
    organization_name: string,
    owner_shortcode: string,
    rowNumber: number,
    rowErrors: CSVError[],
    owner: User,
    manager: EntityManager
) {
    const active_organizations = await OrganizationOwnership.find({
        where: { user_id: owner.user_id, status: Status.ACTIVE },
    })

    if (active_organizations.length) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_ONE_ACTIVE_ORGANIZATION_PER_USER,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_ONE_ACTIVE_ORGANIZATION_PER_USER
        )
        return
    }

    if (owner_shortcode?.length > 0) {
        owner_shortcode = owner_shortcode.toUpperCase()
    }

    const organization = new Organization()
    organization.organization_id = uuid_v4()
    organization.organization_name = organization_name
    organization.shortCode = generateShortCode(organization.organization_id)
    organization.owner = Promise.resolve(owner)
    organization.primary_contact = Promise.resolve(owner)
    await manager.save(organization)

    const adminRoles = [
        await Role.findOneOrFail({
            where: {
                role_name: 'Organization Admin',
                system_role: true,
                organization: { organization_id: null },
            },
        }),
    ]

    const membership = new OrganizationMembership()
    membership.user = Promise.resolve(owner)
    membership.user_id = owner.user_id
    membership.organization = Promise.resolve(organization)
    membership.organization_id = organization.organization_id
    membership.shortcode = owner_shortcode || generateShortCode(owner.user_id)

    if (adminRoles) {
        membership.roles = Promise.resolve(adminRoles)
    }

    organization.memberships = Promise.resolve([membership])
    await manager.save(membership)

    const organizationOwnership = new OrganizationOwnership()
    organizationOwnership.user_id = owner.user_id
    organizationOwnership.organization_id = organization.organization_id
    await manager.save(organizationOwnership)
}

export const processOrganizationFromCSVRow: CreateEntityRowCallback<OrganizationRow> = async (
    manager: EntityManager,
    row: OrganizationRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    const {
        organization_name,
        owner_given_name,
        owner_family_name,
        owner_shortcode,
        owner_email,
        owner_phone,
    } = row

    if (!organization_name) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )
    }

    if (!owner_email && !owner_phone) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_EITHER,
            rowNumber,
            !owner_email ? 'owner_email' : 'owner_phone',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED_EITHER,
            {
                entity: 'user',
                attribute: 'email',
                other_entity: 'user',
                other_attribute: 'phone',
            }
        )
    }

    if (
        owner_shortcode &&
        !validateShortCode(owner_shortcode, config.limits.SHORTCODE_MAX_LENGTH)
    ) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
            rowNumber,
            'owner_shortcode',
            csvErrorConstants.MSG_ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
            {
                entity: 'user',
                attribute: 'short_code',
                max: config.limits.SHORTCODE_MAX_LENGTH,
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    const organizationExists = await Organization.findOne({
        organization_name,
    })

    if (organizationExists) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )

        return rowErrors
    }

    const organizationUploaded = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (organizationUploaded) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_ENTITY,
            {
                name: organization_name,
                entity: 'organization',
            }
        )

        return rowErrors
    }

    const ownerUploaded = await manager.findOne(User, {
        where: [
            { email: owner_email, phone: null },
            { email: null, phone: owner_phone },
            { email: owner_email, phone: owner_phone },
        ],
    })

    if (ownerUploaded) {
        addCsvError(
            rowErrors,
            csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
            rowNumber,
            'owner_email',
            csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
            {
                name: 'Owner',
                entity: 'user',
                parent_entity: 'organization',
                parent_name: organization_name,
            }
        )

        return rowErrors
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    const ownerExists = await getUserByEmailOrPhone(
        manager,
        owner_email,
        owner_phone
    )

    const owner =
        ownerExists ||
        (await createOrganizationOwner(
            owner_given_name,
            owner_family_name,
            owner_email,
            owner_phone
        ))

    if (!ownerExists) {
        await manager.save(owner)
    }

    await createOrganization(
        organization_name,
        owner_shortcode,
        rowNumber,
        rowErrors,
        owner,
        manager
    )

    return rowErrors
}
