import { EntityManager, In } from 'typeorm'

import { Class } from '../../entities/class'
import { Organization } from '../../entities/organization'
import { OrganizationMembership } from '../../entities/organizationMembership'
import { Role } from '../../entities/role'
import { School } from '../../entities/school'
import { SchoolMembership } from '../../entities/schoolMembership'
import { User } from '../../entities/user'
import { UserRow, UserRowRequirements } from '../../types/csv/userRow'
import { generateShortCode } from '../shortcode'
import { v4 as uuid_v4 } from 'uuid'
import { addCsvError, validateRow } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import { userRowValidation } from './validations/user'
import { customErrors } from '../../types/errors/customError'
import validationConstants from '../../entities/validations/constants'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { PermissionName } from '../../permissions/permissionNames'
import { UserPermissions } from '../../permissions/userPermissions'
import { CreateEntityHeadersCallback } from '../../types/csv/createEntityHeadersCallback'
import clean from '../clean'

export const validateUserCSVHeaders: CreateEntityHeadersCallback = async (
    headers: (keyof UserRow)[],
    filename: string,
    fileErrors: CSVError[]
) => {
    fileErrors.push(...UserRowRequirements.validate(headers, filename))
}

export const processUserFromCSVRow: CreateEntityRowCallback<UserRow> = async (
    manager: EntityManager,
    row: UserRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    const rowErrors: CSVError[] = []
    // First check static validation constraints
    const validationErrors = validateRow(row, rowNumber, userRowValidation)
    rowErrors.push(...validationErrors)

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (rowErrors.length > 0) {
        return rowErrors
    }

    // Now check dynamic constraints

    // search for the organization by name as well as user membership
    const org = await Organization.createQueryBuilder('Organization')
        .innerJoin('Organization.memberships', 'OrganizationMembership')
        .where('OrganizationMembership.user_id = :user_id', {
            user_id: userPermissions.getUserId(),
        })
        .andWhere('Organization.organization_name = :organization_name', {
            organization_name: row.organization_name,
        })
        .getOne()

    if (!org) {
        addCsvError(
            rowErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entity: 'Organization',
                attribute: 'Name',
                entityName: row.organization_name,
            }
        )

        return rowErrors
    }

    // is the user authorized to upload to this org?
    try {
        await userPermissions.rejectIfNotAllowed(
            { organization_id: org.organization_id },
            PermissionName.upload_users_40880
        )
    } catch (e) {
        addCsvError(
            rowErrors,
            customErrors.unauthorized_org_upload.code,
            rowNumber,
            'organization_name',
            customErrors.unauthorized_org_upload.message,
            {
                entity: 'user',
                organizationName: row.organization_name,
            }
        )
    }

    let organizationRole = undefined
    if (row.organization_role_name) {
        organizationRole = await manager.findOne(Role, {
            where: [
                {
                    role_name: row.organization_role_name,
                    system_role: true,
                    organization: null,
                },
                {
                    role_name: row.organization_role_name,
                    organization: { organization_id: org.organization_id },
                },
            ],
        })

        if (!organizationRole) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'organization_role_name',
                customErrors.nonexistent_child.message,
                {
                    entity: 'Organization Role',
                    entityName: row.organization_role_name,
                    parentEntity: 'Organization',
                    parentName: row.organization_name,
                }
            )
        }
    }

    let school: School | undefined = undefined
    if (row.school_name) {
        school = await manager.findOne(School, {
            where: {
                school_name: row.school_name,
                organization: { organization_id: org.organization_id },
            },
        })

        if (!school) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'school_name',
                customErrors.nonexistent_child.message,
                {
                    entity: 'School',
                    entityName: row.school_name,
                    parentEntity: 'Organization',
                    parentName: row.organization_name,
                }
            )
        }
    }

    let cls = undefined
    if (row.class_name) {
        cls = await manager.findOne(Class, {
            where: {
                class_name: row.class_name,
                organization: { organization_id: org.organization_id },
            },
        })

        const classIsAssignedToSchool = (await cls?.schools)?.find(
            (s) => s.school_id === school?.school_id
        )

        if (!cls || !school || !classIsAssignedToSchool) {
            addCsvError(
                rowErrors,
                customErrors.nonexistent_child.code,
                rowNumber,
                'class_name',
                customErrors.nonexistent_child.message,
                {
                    entity: 'Class',
                    entityName: row.class_name,
                    parentEntity: 'School',
                    parentName: row.school_name,
                }
            )
        }
    }

    if (rowErrors.length > 0) {
        return rowErrors
    }

    const rawEmail = row.user_email
    row.user_email = clean.email(row.user_email) || undefined
    row.user_phone = clean.phone(row.user_phone) || undefined
    row.user_gender = row.user_gender?.toLowerCase()

    const personalInfo = {
        given_name: row.user_given_name,
        family_name: row.user_family_name,
    }

    let user = await manager.findOne(User, {
        where: [
            {
                // search for both the normalized and raw value.
                // only need to do this because we were previously saving the raw
                // value instead of the normalized value.
                // this could be removed if a DB migration was run to normalize all email values.
                email: In([rawEmail, clean.email(rawEmail)]),
                ...personalInfo,
            },
            { phone: row.user_phone, ...personalInfo },
        ],
    })
    let isNewUser = false
    if (!user) {
        user = new User()
        user.user_id = uuid_v4()
        isNewUser = true
    }

    if (isNewUser && row.user_email) {
        user.email = row.user_email
    }

    if (isNewUser && row.user_phone) {
        user.phone = row.user_phone
    }

    if (isNewUser && row.user_given_name) {
        user.given_name = row.user_given_name
    }

    if (isNewUser && row.user_family_name) {
        user.family_name = row.user_family_name
    }

    if (row.user_date_of_birth) {
        user.date_of_birth = row.user_date_of_birth
    }

    if (row.user_gender) {
        user.gender = row.user_gender
    }

    if (row.user_alternate_email) {
        user.alternate_email = clean.email(row.user_alternate_email)
    }

    if (row.user_alternate_phone) {
        user.alternate_phone = clean.phone(row.user_alternate_phone)
    }

    if (row.user_shortcode) {
        const userShortcode = await manager.findOne(OrganizationMembership, {
            where: {
                shortcode: row.user_shortcode,
                organization: { organization_id: org.organization_id },
            },
        })

        if (userShortcode && user.user_id !== userShortcode.user_id) {
            addCsvError(
                rowErrors,
                customErrors.duplicate_entity.code,
                rowNumber,
                'user_shortcode',
                customErrors.duplicate_entity.message,
                {
                    entity: 'Short Code',
                    entityName: row.user_shortcode,
                }
            )
        }
    }

    // never save if there are any errors in the file
    if (fileErrors.length > 0 || rowErrors.length > 0) {
        return rowErrors
    }

    await manager.save(user)

    let organizationMembership = await manager.findOne(OrganizationMembership, {
        where: {
            organization_id: org.organization_id,
            user_id: user.user_id,
        },
    })

    if (!organizationMembership) {
        organizationMembership = new OrganizationMembership()
        organizationMembership.organization_id = org.organization_id
        organizationMembership.organization = Promise.resolve(org)
        organizationMembership.user_id = user.user_id
        organizationMembership.user = Promise.resolve(user)
        organizationMembership.shortcode =
            row.user_shortcode ||
            generateShortCode(
                user.user_id,
                validationConstants.SHORTCODE_MAX_LENGTH
            )
    } else if (row.user_shortcode) {
        organizationMembership.shortcode = row.user_shortcode
    }

    if (organizationRole) {
        const organizationRoles = (await organizationMembership.roles) || []

        if (!organizationRoles.includes(organizationRole)) {
            organizationRoles.push(organizationRole)
            organizationMembership.roles = Promise.resolve(organizationRoles)
        }
    }

    await manager.save(organizationMembership)

    if (school) {
        let schoolMembership = await manager.findOne(SchoolMembership, {
            where: {
                school_id: school.school_id,
                user_id: user.user_id,
            },
        })

        if (!schoolMembership) {
            schoolMembership = new SchoolMembership()
            schoolMembership.school_id = school.school_id
            schoolMembership.school = Promise.resolve(school)
            schoolMembership.user_id = user.user_id
            schoolMembership.user = Promise.resolve(user)
            await manager.save(schoolMembership)
        }

        if (organizationRole && cls) {
            const roleName = organizationRole?.role_name

            if (roleName?.includes('Student')) {
                const students = (await cls.students) || []

                if (!students.includes(user)) {
                    students.push(user)
                    cls.students = Promise.resolve(students)
                }
            } else if (roleName?.includes('Teacher')) {
                const teachers = (await cls.teachers) || []

                if (!teachers.includes(user)) {
                    teachers.push(user)
                    cls.teachers = Promise.resolve(teachers)
                }
            }

            await manager.save(cls)
        }
    }

    return rowErrors
}
