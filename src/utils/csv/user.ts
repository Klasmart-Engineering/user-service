import { EntityManager } from 'typeorm'

import { Class } from '../../entities/class'
import {
    Organization,
    normalizedLowercaseTrimmed,
} from '../../entities/organization'
import {
    OrganizationMembership,
    MEMBERSHIP_SHORTCODE_MAXLEN,
} from '../../entities/organizationMembership'
import { Role } from '../../entities/role'
import { School } from '../../entities/school'
import { SchoolMembership } from '../../entities/schoolMembership'
import { User } from '../../entities/user'
import { UserRow } from '../../types/csv/userRow'
import { generateShortCode, validateShortCode } from '../shortcode'
import { v4 as uuid_v4 } from 'uuid'
import { addCsvError } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import csvErrorConstants from '../../types/errors/csv/csvErrorConstants'
import { validateDOB, validateEmail, validatePhone } from '../validations'
import validationConstants from './validationConstants'

export const processUserFromCSVRow = async (
    manager: EntityManager,
    row: UserRow,
    rowNumber: number,
    fileErrors: CSVError[]
) => {
    if (!row.organization_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'organization',
                attribute: 'name',
            }
        )
    }

    if (!row.user_email && !row.user_phone) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED_EITHER,
            rowNumber,
            'user_email, user_phone',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED_EITHER,
            {
                entity: 'user',
                attribute: 'email',
                other_entity: 'user',
                other_attribute: 'phone',
            }
        )
    }

    if (row.user_date_of_birth && !validateDOB(row.user_date_of_birth)) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_DATE_FORMAT,
            rowNumber,
            'date_of_birth',
            csvErrorConstants.MSG_ERR_CSV_INVALID_DATE_FORMAT,
            {
                entity: 'user',
                attribute: 'date_of_birth',
                format: 'MM-YYYY',
            }
        )
    }

    if (row.user_shortcode?.length > 0) {
        if (
            !validateShortCode(row.user_shortcode, MEMBERSHIP_SHORTCODE_MAXLEN)
        ) {
            addCsvError(
                fileErrors,
                csvErrorConstants.ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
                rowNumber,
                'user_shortcode',
                csvErrorConstants.MSG_ERR_CSV_INVALID_UPPERCASE_ALPHA_NUM_WITH_MAX,
                {
                    entity: 'user',
                    attribute: 'shortcode',
                    max: MEMBERSHIP_SHORTCODE_MAXLEN,
                }
            )
        }
    }

    if (row.user_email && !validateEmail(row.user_email)) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_EMAIL,
            rowNumber,
            'user_email',
            csvErrorConstants.MSG_ERR_CSV_INVALID_EMAIL,
            {
                entity: 'user',
                attribute: 'email',
            }
        )
    }

    if (!row.organization_role_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'organization_role_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'user',
                attribute: 'organization role',
            }
        )
    }

    if (!row.user_given_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'user_given_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'user',
                attribute: 'given name',
            }
        )
    }

    if (
        row.user_given_name?.length >
        validationConstants.USER_GIVEN_NAME_MAX_LENGTH
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_LENGTH,
            rowNumber,
            'user_given_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_LENGTH,
            {
                entity: 'user',
                attribute: 'given name',
                max: validationConstants.USER_GIVEN_NAME_MAX_LENGTH,
            }
        )
    }

    if (!row.user_family_name) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
            rowNumber,
            'user_family_name',
            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
            {
                entity: 'user',
                attribute: 'family name',
            }
        )
    }

    if (row.user_phone && !validatePhone(row.user_phone)) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_PHONE,
            rowNumber,
            'user_phone',
            csvErrorConstants.MSG_ERR_CSV_INVALID_PHONE,
            {
                entity: 'user',
                attribute: 'phone',
            }
        )
    }

    if (
        row.user_family_name?.length >
        validationConstants.USER_FAMILY_NAME_MAX_LENGTH
    ) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_INVALID_LENGTH,
            rowNumber,
            'user_family_name',
            csvErrorConstants.MSG_ERR_CSV_INVALID_LENGTH,
            {
                entity: 'user',
                attribute: 'family name',
                max: validationConstants.USER_FAMILY_NAME_MAX_LENGTH,
            }
        )
    }

    // Return if there are any validation errors so that we don't need to waste any DB queries
    if (fileErrors && fileErrors.length > 0) {
        return
    }

    const org = await manager.findOne(Organization, {
        organization_name: row.organization_name,
    })

    if (!org) {
        addCsvError(
            fileErrors,
            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
            rowNumber,
            'organization_name',
            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
            {
                entity: 'organization',
                name: row.organization_name,
            }
        )

        return
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
                csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
                rowNumber,
                'organization_role_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
                {
                    entity: 'organizationRole',
                    name: row.organization_role_name,
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
                csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
                rowNumber,
                'organization_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
                {
                    entity: 'school',
                    name: row.school_name,
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
                csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
                rowNumber,
                'school_role_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
                {
                    entity: 'organizationRole',
                    name: row.school_role_name,
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
                csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
                rowNumber,
                'school_role_name',
                csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
                {
                    entity: 'class',
                    name: row.class_name,
                }
            )
        }
    }

    if (fileErrors && fileErrors.length > 0) {
        return
    }

    let email = row.user_email
    let phone = row.user_phone

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
                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                rowNumber,
                'school_shortcode',
                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                {
                    entity: 'shortcode',
                    name: row.user_shortcode,
                    parent_name: (await userShortcode.user)?.full_name(),
                    parent_entity: 'user',
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
            generateShortCode(user.user_id, MEMBERSHIP_SHORTCODE_MAXLEN)
    } else if (organizationMembership.shortcode !== row.user_shortcode) {
        organizationMembership.shortcode =
            row.user_shortcode ||
            generateShortCode(user.user_id, MEMBERSHIP_SHORTCODE_MAXLEN)
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
