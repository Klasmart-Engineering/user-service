import { EntityManager } from 'typeorm'

import { Class } from '../../entities/class'
import {
    Organization,
    normalizedLowercaseTrimmed,
} from '../../entities/organization'
import { OrganizationMembership } from '../../entities/organizationMembership'
import { Role } from '../../entities/role'
import { School } from '../../entities/school'
import { SchoolMembership } from '../../entities/schoolMembership'
import { User } from '../../entities/user'
import { UserRow } from '../../types/csv/userRow'
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
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'

export const processUserFromCSVRow: CreateEntityRowCallback<UserRow> = async (
    manager: EntityManager,
    row: UserRow,
    rowNumber: number,
    fileErrors: CSVError[],
    userPermissions: UserPermissions
) => {
    // First check static validation constraints
    const validationErrors = validateRow(row, rowNumber, userRowValidation)
    fileErrors.push(...validationErrors)

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    // Now check dynamic constraints
    const org = await manager.findOne(Organization, {
        organization_name: row.organization_name,
    })

    if (!org) {
        addCsvError(
            fileErrors,
            customErrors.nonexistent_entity.code,
            rowNumber,
            'organization_name',
            customErrors.nonexistent_entity.message,
            {
                entity: 'organization',
                entityName: row.organization_name,
            }
        )

        return
    }

    // is the user authorized to upload to this org?
    try {
        await userPermissions.rejectIfNotAllowed(
            { organization_id: org.organization_id },
            PermissionName.upload_users_40880
        )
    } catch (e) {
        addCsvError(
            fileErrors,
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
                fileErrors,
                customErrors.nonexistent_entity.code,
                rowNumber,
                'organization_role_name',
                customErrors.nonexistent_entity.message,
                {
                    entity: 'user',
                    attribute: 'organization_role',
                    entityName: row.organization_role_name,
                }
            )
        }
    }

    let school = undefined
    if (row.school_name) {
        school = await manager.findOne(School, {
            where: {
                school_name: row.school_name,
                organization: { organization_id: org.organization_id },
            },
        })

        if (!school) {
            addCsvError(
                fileErrors,
                customErrors.nonexistent_entity.code,
                rowNumber,
                'school_name',
                customErrors.nonexistent_entity.message,
                {
                    entity: 'school',
                    attribute: 'name',
                    entityName: row.school_name,
                }
            )
        }
    }

    let schoolRole = undefined
    if (row.school_role_name) {
        schoolRole = await manager.findOne(Role, {
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

        if (!schoolRole) {
            addCsvError(
                fileErrors,
                customErrors.nonexistent_entity.code,
                rowNumber,
                'school_role_name',
                customErrors.nonexistent_entity.message,
                {
                    entity: 'organizationRole',
                    entityName: row.school_role_name,
                    attribute: 'school_role',
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

        if (!cls) {
            addCsvError(
                fileErrors,
                customErrors.nonexistent_entity.code,
                rowNumber,
                'class_name',
                customErrors.nonexistent_entity.message,
                {
                    entity: 'class',
                    entityName: row.class_name,
                    attribute: 'name',
                }
            )
        }
    }

    if (fileErrors && fileErrors.length > 0) {
        return
    }


    let email = row.user_email
    let phone = row.user_phone

    if( !email && !phone) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_EITHER,
            rowNumber,
            'email',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED_EITHER,
            {
                entity: 'user',
                attribute: 'email',
                other_entity: 'user',
                other_attribute: 'phone',
            }
        )

        return
    }

    if (email) {
        email = normalizedLowercaseTrimmed(email)
    }

    if (phone) {
        phone = normalizedLowercaseTrimmed(phone)
    }

    row.user_gender = row.user_gender?.toLowerCase()

    const personalInfo = {
        given_name: row.user_given_name,
        family_name: row.user_family_name,
    }

    let user = await manager.findOne(User, {
        where: [
            { email: email, phone: null, ...personalInfo },
            { email: null, phone: phone, ...personalInfo },
            { email: email, phone: phone, ...personalInfo },
        ],
    })
    let isNewUser = false
    if (!user) {
        user = new User()
        user.user_id = uuid_v4()
        isNewUser = true
    }

    if (isNewUser && email) {
        user.email = row.user_email
    }

    if (isNewUser && phone) {
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

    if (row.user_shortcode) {
        const userShortcode = await manager.findOne(OrganizationMembership, {
            where: {
                shortcode: row.user_shortcode,
                organization: { organization_id: org.organization_id },
            },
        })

        if (userShortcode && user.user_id !== userShortcode.user_id) {
            addCsvError(
                fileErrors,
                customErrors.duplicate_entity.code,
                rowNumber,
                'user_shortcode',
                customErrors.duplicate_entity.message,
                {
                    entity: 'shortcode',
                    entityName: row.user_shortcode,
                }
            )
        }
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
    } else if (organizationMembership.shortcode !== row.user_shortcode) {
        organizationMembership.shortcode =
            row.user_shortcode ||
            generateShortCode(
                user.user_id,
                validationConstants.SHORTCODE_MAX_LENGTH
            )
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
        }

        if (schoolRole) {
            const schoolRoles = (await schoolMembership.roles) || []

            if (!schoolRoles.includes(schoolRole)) {
                schoolRoles.push(schoolRole)
                schoolMembership.roles = Promise.resolve(schoolRoles)
            }
        }

        await manager.save(schoolMembership)

        if ((organizationRole || schoolRole) && cls) {
            const roleName =
                organizationRole?.role_name || schoolRole?.role_name

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
}
