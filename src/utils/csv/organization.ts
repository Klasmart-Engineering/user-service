import { EntityManager } from 'typeorm'
import { v4 as uuid_v4 } from 'uuid'
import { accountUUID, User } from '../../entities/user'
import { OrganizationRow } from '../../types/csv/organizationRow'
import { generateShortCode, validateShortCode } from '../shortcode'
import {
    normalizedLowercaseTrimmed,
    Organization,
} from '../../entities/organization'
import {
    MEMBERSHIP_SHORTCODE_MAXLEN,
    OrganizationMembership,
} from '../../entities/organizationMembership'
import { OrganizationOwnership } from '../../entities/organizationOwnership'
import { Role } from '../../entities/role'
import { Status } from '../../entities/status'
import { saveError } from './readFile'

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
    fileErrors: string[],
    owner: User,
    manager: EntityManager
) {
    const active_organizations = await OrganizationOwnership.find({
        where: { user_id: owner.user_id, status: Status.ACTIVE },
    })

    if (active_organizations.length) {
        saveError(
            fileErrors,
            rowNumber,
            'Only one active organization per user'
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

export async function processOrganizationFromCSVRow(
    manager: EntityManager,
    row: OrganizationRow,
    rowNumber: number,
    fileErrors: string[]
) {
    const {
        organization_name,
        owner_given_name,
        owner_family_name,
        owner_shortcode,
        owner_email,
        owner_phone,
    } = row

    const requiredFieldsAreProvided =
        organization_name && (owner_email || owner_phone)

    if (!organization_name) {
        saveError(fileErrors, rowNumber, "Organization name doesn't exists")
    }

    if (!owner_email && !owner_phone) {
        saveError(
            fileErrors,
            rowNumber,
            "There's no exist owner's email or phone"
        )
    }

    if (
        owner_shortcode &&
        !validateShortCode(owner_shortcode, MEMBERSHIP_SHORTCODE_MAXLEN)
    ) {
        saveError(fileErrors, rowNumber, 'Invalid shortcode provided')
    }

    if (!requiredFieldsAreProvided) {
        return
    }

    const organizationExists = await Organization.findOne({
        organization_name,
    })

    if (organizationExists) {
        saveError(
            fileErrors,
            rowNumber,
            `Organization with name '${organization_name}' already exists!`
        )

        return
    }

    const organizationUploaded = await manager.findOne(Organization, {
        where: { organization_name },
    })

    if (organizationUploaded) {
        saveError(
            fileErrors,
            rowNumber,
            `Organization with name '${organization_name}' already uploaded`
        )

        return
    }

    const ownerUploaded = await manager.findOne(User, {
        where: [
            { email: owner_email, phone: null },
            { email: null, phone: owner_phone },
            { email: owner_email, phone: owner_phone },
        ],
    })

    if (ownerUploaded) {
        saveError(
            fileErrors,
            rowNumber,
            `Owner with email '${owner_email}' already has an organization`
        )
        return
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
        fileErrors,
        owner,
        manager
    )
}
