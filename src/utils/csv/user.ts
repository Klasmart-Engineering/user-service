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
import { addCsvError, QueryResultCache, validateRow } from '../csv/csvUtils'
import { CSVError } from '../../types/csv/csvError'
import { userRowValidation } from './validations/user'
import { customErrors } from '../../types/errors/customError'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { PermissionName } from '../../permissions/permissionNames'
import { UserPermissions } from '../../permissions/userPermissions'
import { CreateEntityHeadersCallback } from '../../types/csv/createEntityHeadersCallback'
import clean from '../clean'
import { Permission } from '../../entities/permission'
import { config } from '../../config/config'
import { objectToKey } from '../stringUtils'

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
    userPermissions: UserPermissions,
    queryResultCache: QueryResultCache
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
    let org: Organization | undefined
    let organizationRole: Role | undefined
    let school: School | undefined
    let cls: Class | undefined

    // Does the organization exist? And is the client user part of it?
    org = queryResultCache.validatedOrgs.get(row.organization_name)
    if (!org) {
        org = await Organization.createQueryBuilder('Organization')
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

        // And is the user authorized to upload to this org?
        try {
            await userPermissions.rejectIfNotAllowed(
                { organization_ids: [org.organization_id] },
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
            // AD-1721: Added because validation process should not reveal validity of other entities after this point if client user unauthorized. Discussed with Charlie (PM).
            return rowErrors
        }

        // Update the cache
        queryResultCache.validatedOrgs.set(row.organization_name, org)
    }

    // Does the provided org role exist in its org?
    organizationRole = queryResultCache.validatedOrgRoles.get(
        row.organization_role_name
    )
    if (!organizationRole) {
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
                    entityValue: row.organization_role_name,
                    parentEntity: 'Organization',
                    parentValue: row.organization_name,
                }
            )
        } else {
            // Update the cache
            queryResultCache.validatedOrgRoles.set(
                row.organization_role_name,
                organizationRole
            )
        }
    }

    // Does the school exist in the org?
    let schoolIfPresentExistsInOrg = true
    if (row.school_name) {
        school = queryResultCache.validatedSchools.get(
            objectToKey({
                school_name: row.school_name,
                org_id: org.organization_id,
            })
        )
        if (!school) {
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
                        entityValue: row.school_name,
                        parentEntity: 'Organization',
                        parentValue: row.organization_name,
                    }
                )
                schoolIfPresentExistsInOrg = false
            } else {
                // Update the cache
                queryResultCache.validatedSchools.set(
                    objectToKey({
                        school_name: row.school_name,
                        org_id: org.organization_id,
                    }),
                    school
                )
            }
        }
    }

    // Does the class exist in the org?
    if (row.class_name && schoolIfPresentExistsInOrg) {
        if (school) {
            cls = queryResultCache.validatedClasses.get(
                objectToKey({
                    class_name: row.class_name,
                    school_id: school.school_id,
                    org_id: org.organization_id,
                })
            )
        } else {
            cls = queryResultCache.validatedClasses.get(
                objectToKey({
                    class_name: row.class_name,
                    org_id: org.organization_id,
                })
            )
        }

        if (!cls) {
            cls = await manager.findOne(Class, {
                where: {
                    class_name: row.class_name,
                    organization: { organization_id: org.organization_id },
                },
            })

            const classSchools = (await cls?.schools) || []
            const classIsAssignedToSchool =
                classSchools.length > 0 && school
                    ? classSchools?.find(
                          (s) => s.school_id === school?.school_id
                      )
                    : false

            if (
                !cls ||
                (school && !classIsAssignedToSchool) ||
                (cls && !school && classSchools.length > 0)
            ) {
                addCsvError(
                    rowErrors,
                    customErrors.nonexistent_child.code,
                    rowNumber,
                    'class_name',
                    customErrors.nonexistent_child.message,
                    {
                        entity: 'Class',
                        entityValue: row.class_name,
                        parentEntity: 'School',
                        parentValue: row.school_name || '',
                    }
                )
            } else {
                // Update the cache
                if (school) {
                    queryResultCache.validatedClasses.set(
                        objectToKey({
                            class_name: row.class_name,
                            school_id: school.school_id,
                            org_id: org.organization_id,
                        }),
                        cls
                    )
                } else {
                    queryResultCache.validatedClasses.set(
                        objectToKey({
                            class_name: row.class_name,
                            org_id: org.organization_id,
                        }),
                        cls
                    )
                }
            }
        }
    }

    if (rowErrors.length > 0) {
        return rowErrors
    }

    const rawEmail = row.user_email
    row.user_email = clean.email(row.user_email) || undefined
    // we don't need to catch errors here
    // as its already pass validation
    // so the cleaning will succeed
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
            { username: row.user_username, ...personalInfo },
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

    if (isNewUser && row.user_username) {
        user.username = row.user_username
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
        // don't throw errors as they will of already been
        // found by validation but this code runs before we return them
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
                customErrors.existent_entity.code,
                rowNumber,
                'user_shortcode',
                customErrors.existent_entity.message,
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
            generateShortCode(user.user_id, config.limits.SHORTCODE_MAX_LENGTH)
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
    }

    if (cls) {
        const perms = await manager
            .createQueryBuilder(Permission, 'Permission')
            .innerJoin('Permission.roles', 'Role')
            .innerJoin('Role.memberships', 'OrganizationMembership')
            .where('OrganizationMembership.user_id = :user_id', {
                user_id: user.user_id,
            })
            .andWhere(
                'OrganizationMembership.organization_id = :organization_id',
                {
                    organization_id: organizationMembership.organization_id,
                }
            )
            .getMany()

        const teacherPerm =
            perms.some(
                (p) =>
                    p.permission_name ===
                    PermissionName.attend_live_class_as_a_teacher_186.valueOf()
            ) || false
        const studentPerm =
            perms.some(
                (p) =>
                    p.permission_name ===
                    PermissionName.attend_live_class_as_a_student_187.valueOf()
            ) || false

        if (teacherPerm) {
            const teachers = (await cls.teachers) || []
            if (!teachers.includes(user)) {
                teachers.push(user)
                cls.teachers = Promise.resolve(teachers)
            }
        }
        if (studentPerm) {
            const students = (await cls.students) || []
            if (!students.includes(user)) {
                students.push(user)
                cls.students = Promise.resolve(students)
            }
        }
        if (!studentPerm && !teacherPerm) {
            addCsvError(
                rowErrors,
                customErrors.unauthorized_upload_child.code,
                rowNumber,
                'organization_role_name',
                customErrors.unauthorized_upload_child.message,
                {
                    entity: 'User',
                    parentEntity: 'Class',
                    parentName: row.class_name,
                }
            )
        } else {
            await manager.save(cls)
        }
    }

    return rowErrors
}
