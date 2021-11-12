import DataLoader from 'dataloader'
import { AgeRange } from '../entities/ageRange'
import { Category } from '../entities/category'
import { Class } from '../entities/class'
import { Grade } from '../entities/grade'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Program } from '../entities/program'
import { Role } from '../entities/role'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import { Subcategory } from '../entities/subcategory'
import {
    mapAgeRangeToAgeRangeConnectionNode,
    ageRangeNodeFields,
} from '../pagination/ageRangesConnection'
import {
    categoryConnectionNodeFields,
    mapCategoryToCategoryConnectionNode,
} from '../pagination/categoriesConnection'
import {
    coreClassConnectionNodeFields,
    CoreClassConnectionNode,
    mapClassToClassConnectionNode,
    classesConnectionSortingConfig,
    classesConnectionQuery,
} from '../pagination/classesConnection'
import {
    gradeSummaryNodeFields,
    mapGradeToGradeConnectionNode,
} from '../pagination/gradesConnection'
import {
    mapProgramToProgramConnectionNode,
    programSummaryNodeFields,
} from '../pagination/programsConnection'
import {
    CoreOrganizationConnectionNode,
    mapOrganizationToOrganizationConnectionNode,
    organizationSummaryNodeFields,
} from '../pagination/organizationsConnection'
import {
    mapSchoolToSchoolConnectionNode,
    schoolConnectionQuery,
    schoolsConnectionSortingConfig,
} from '../pagination/schoolsConnection'
import {
    CoreUserConnectionNode,
    coreUserConnectionNodeFields,
    mapUserToUserConnectionNode,
    userConnectionSortingConfig,
    usersConnectionQuery,
} from '../pagination/usersConnection'
import {
    subcategoryConnectionNodeFields,
    mapSubcategoryToSubcategoryConnectionNode,
} from '../pagination/subcategoriesConnection'
import { SubcategoryConnectionNode } from '../types/graphQL/subcategory'
import { ISubcategoryNodeDataLoader } from './subcategory'
import { UserPermissions } from '../permissions/userPermissions'
import { BrandingResult } from '../types/graphQL/branding'
import { CategorySummaryNode } from '../types/graphQL/category'
import { ClassSummaryNode } from '../types/graphQL/classSummaryNode'
import {
    ISchoolsConnectionNode,
    SchoolSummaryNode,
} from '../types/graphQL/school'
import { Lazy } from '../utils/lazyLoading'
import { IPaginatedResponse } from '../utils/pagination/paginate'
import { IAgeRangeNodeDataLoader } from './ageRange'
import { ICategoryNodeDataLoader } from './category'
import {
    childConnectionLoader,
    IChildConnectionDataloaderKey,
} from './childConnectionLoader'
import {
    ageRangesForClasses,
    gradesForClasses,
    IClassesConnectionLoaders,
    IClassNodeDataLoaders,
    programsForClasses,
    schoolsForClasses,
    subjectsForClasses,
} from './classesConnection'
import {
    fromGradeForGrades,
    IGradeNodeDataLoaders,
    IGradesConnectionLoaders,
    toGradeForGrades,
} from './gradesConnection'
import {
    brandingForOrganizations,
    IOrganizationLoaders,
    organizationForMemberships,
} from './organization'
import {
    IOrganizationNodeDataLoaders,
    IOrganizationsConnectionLoaders,
    ownersForOrgs,
} from './organizationsConnection'
import { NodeDataLoader } from './genericNode'
import {
    ISchoolLoaders,
    organizationsForSchools,
    SchoolNodeDataLoader,
    schoolsByIds,
} from './school'
import {
    ageRangesForPrograms,
    gradesForPrograms,
    IProgramNodeDataLoaders,
    IProgramsConnectionLoaders,
    subjectsForPrograms,
} from './programsConnection'
import { ISubjectsConnectionLoaders } from './subjectsConnection'
import { ProgramSummaryNode } from '../types/graphQL/program'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRange'
import { GradeSummaryNode } from '../types/graphQL/grade'
import { SubjectSummaryNode } from '../types/graphQL/subject'
import { UserSummaryNode } from '../types/graphQL/user'
import {
    IUserNodeDataLoaders,
    IUsersLoaders,
    orgMembershipsForUsers,
    schoolMembershipsForUsers,
    usersByIds,
} from './user'
import {
    IUsersConnectionLoaders,
    orgsForUsers,
    rolesForUsers,
    schoolsForUsers,
} from './usersConnection'
import { Permission } from '../entities/permission'
import {
    IPermissionNodeDataLoaders,
    mapPermissionToPermissionConnectionNode,
    permissionSummaryNodeFields,
} from '../pagination/permissionsConnection'
import { PermissionConnectionNode } from '../types/graphQL/permission'
import {
    IRoleNodeDataLoaders,
    mapRoleToRoleConnectionNode,
    roleConnectionQuery,
    rolesConnectionSortingConfig,
    roleConnectionNodeFields,
} from '../pagination/rolesConnection'
import { RoleSummaryNode } from '../types/graphQL/role'
import { OrganizationMembershipConnectionNode } from '../types/graphQL/organizationMemberships'
import {
    mapOrganizationMembershipToOrganizationMembershipNode,
    organizationMembershipConnectionQuery,
    organizationMembershipsConnectionSortingConfig,
} from '../pagination/organizationMembershipsConnection'
import { RoleConnectionNode } from '../types/graphQL/role'

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection: IProgramsConnectionLoaders
    programNode: IProgramNodeDataLoaders
    gradesConnection: IGradesConnectionLoaders
    classesConnection: IClassesConnectionLoaders
    subjectsConnection?: ISubjectsConnectionLoaders
    organizationsConnection: IOrganizationsConnectionLoaders
    user: IUsersLoaders
    userNode: IUserNodeDataLoaders
    organization: IOrganizationLoaders
    school: ISchoolLoaders
    classNode: IClassNodeDataLoaders
    roleNode: IRoleNodeDataLoaders
    gradeNode: IGradeNodeDataLoaders
    organizationNode: IOrganizationNodeDataLoaders
    permissionNode: IPermissionNodeDataLoaders
    subcategoryNode: ISubcategoryNodeDataLoader
    ageRangeNode: IAgeRangeNodeDataLoader

    usersConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<CoreUserConnectionNode>
        >
    >
    organizationMembershipsConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<OrganizationMembershipConnectionNode>
        >
    >
    schoolsConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<ISchoolsConnectionNode>
        >
    >
    rolesConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<RoleConnectionNode>
        >
    >
    classesConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<CoreClassConnectionNode>
        >
    >
    categoryNode: ICategoryNodeDataLoader
    schoolNode: Lazy<NodeDataLoader<School, ISchoolsConnectionNode>>
}

export function createContextLazyLoaders(
    permissions: UserPermissions
): IDataLoaders {
    return {
        user: {
            user: new Lazy<DataLoader<string, User | Error>>(
                () => new DataLoader(usersByIds)
            ),
            orgMemberships: new Lazy<
                DataLoader<string, OrganizationMembership[]>
            >(() => new DataLoader(orgMembershipsForUsers)),
            schoolMemberships: new Lazy<DataLoader<string, SchoolMembership[]>>(
                () => new DataLoader(schoolMembershipsForUsers)
            ),
        },
        organization: {
            branding: new Lazy<DataLoader<string, BrandingResult | undefined>>(
                () => new DataLoader(brandingForOrganizations)
            ),
            organization: new Lazy<
                DataLoader<string, Organization | undefined>
            >(() => new DataLoader(organizationForMemberships)),
        },
        school: {
            organization: new Lazy<
                DataLoader<string, Organization | undefined>
            >(() => new DataLoader(organizationsForSchools)),
            schoolById: new Lazy<DataLoader<string, School | undefined>>(
                () => new DataLoader(schoolsByIds)
            ),
        },
        usersConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        usersConnectionQuery,
                        mapUserToUserConnectionNode,
                        userConnectionSortingConfig,
                        { permissions, entity: 'user' }
                    )
                })
        ),
        organizationMembershipsConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        organizationMembershipConnectionQuery,
                        mapOrganizationMembershipToOrganizationMembershipNode,
                        organizationMembershipsConnectionSortingConfig,
                        { permissions, entity: 'organizationMembership' }
                    )
                })
        ),
        schoolsConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        schoolConnectionQuery,
                        mapSchoolToSchoolConnectionNode,
                        schoolsConnectionSortingConfig,
                        { permissions, entity: 'school' }
                    )
                })
        ),
        rolesConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        (scope, filter) => {
                            roleConnectionQuery(scope, filter)
                            return Promise.resolve(scope)
                        },
                        mapRoleToRoleConnectionNode,
                        rolesConnectionSortingConfig,
                        { permissions, entity: 'role' }
                    )
                })
        ),
        classesConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        classesConnectionQuery,
                        mapClassToClassConnectionNode,
                        classesConnectionSortingConfig,
                        { permissions, entity: 'class' }
                    )
                })
        ),
        userNode: {
            node: new Lazy<NodeDataLoader<User, CoreUserConnectionNode>>(
                () =>
                    new NodeDataLoader(
                        User,
                        'UserConnectionNode',
                        mapUserToUserConnectionNode,
                        coreUserConnectionNodeFields
                    )
            ),
            organizations: new DataLoader((keys) => orgsForUsers(keys)),
            schools: new DataLoader((keys) => schoolsForUsers(keys)),
            roles: new DataLoader((keys) => rolesForUsers(keys)),
        },
        subcategoryNode: {
            node: new Lazy<
                NodeDataLoader<Subcategory, SubcategoryConnectionNode>
            >(
                () =>
                    new NodeDataLoader(
                        Subcategory,
                        'SubcategoryConnectionNode',
                        mapSubcategoryToSubcategoryConnectionNode,
                        subcategoryConnectionNodeFields
                    )
            ),
        },
        programsConnection: {
            ageRanges: new Lazy<DataLoader<string, AgeRangeConnectionNode[]>>(
                () => new DataLoader(ageRangesForPrograms)
            ),
            grades: new Lazy<DataLoader<string, GradeSummaryNode[]>>(
                () => new DataLoader(gradesForPrograms)
            ),
            subjects: new Lazy<DataLoader<string, SubjectSummaryNode[]>>(
                () => new DataLoader(subjectsForPrograms)
            ),
        },
        programNode: {
            node: new Lazy<NodeDataLoader<Program, ProgramSummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Program,
                        'ProgramConnectionNode',
                        mapProgramToProgramConnectionNode,
                        programSummaryNodeFields
                    )
            ),
        },
        organizationsConnection: {
            owners: new Lazy<DataLoader<string, UserSummaryNode[]>>(
                () => new DataLoader(ownersForOrgs)
            ),
        },
        organizationNode: {
            node: new Lazy<
                NodeDataLoader<Organization, CoreOrganizationConnectionNode>
            >(
                () =>
                    new NodeDataLoader(
                        Organization,
                        'OrganizationConnectionNode',
                        mapOrganizationToOrganizationConnectionNode,
                        organizationSummaryNodeFields
                    )
            ),
        },
        schoolNode: new Lazy<SchoolNodeDataLoader>(
            () => new SchoolNodeDataLoader()
        ),
        classesConnection: {
            schools: new Lazy<DataLoader<string, SchoolSummaryNode[]>>(
                () => new DataLoader(schoolsForClasses)
            ),
            ageRanges: new Lazy<DataLoader<string, AgeRangeConnectionNode[]>>(
                () => new DataLoader(ageRangesForClasses)
            ),
            grades: new Lazy<DataLoader<string, GradeSummaryNode[]>>(
                () => new DataLoader(gradesForClasses)
            ),
            subjects: new Lazy<DataLoader<string, SubjectSummaryNode[]>>(
                () => new DataLoader(subjectsForClasses)
            ),
            programs: new Lazy<DataLoader<string, ProgramSummaryNode[]>>(
                () => new DataLoader(programsForClasses)
            ),
        },
        classNode: {
            node: new Lazy<NodeDataLoader<Class, ClassSummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Class,
                        'ClassConnectionNode',
                        mapClassToClassConnectionNode,
                        coreClassConnectionNodeFields
                    )
            ),
        },
        roleNode: {
            node: new Lazy<NodeDataLoader<Role, RoleSummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Role,
                        'RoleConnectionNode',
                        mapRoleToRoleConnectionNode,
                        roleConnectionNodeFields
                    )
            ),
        },
        gradesConnection: {
            fromGrade: new Lazy<
                DataLoader<string, GradeSummaryNode | undefined>
            >(() => new DataLoader(fromGradeForGrades)),
            toGrade: new Lazy<DataLoader<string, GradeSummaryNode | undefined>>(
                () => new DataLoader(toGradeForGrades)
            ),
        },
        gradeNode: {
            node: new Lazy<NodeDataLoader<Grade, GradeSummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Grade,
                        'GradeConnectionNode',
                        mapGradeToGradeConnectionNode,
                        gradeSummaryNodeFields
                    )
            ),
        },
        permissionNode: {
            node: new Lazy<
                NodeDataLoader<Permission, PermissionConnectionNode>
            >(
                () =>
                    new NodeDataLoader(
                        Permission,
                        'PermissionConnectionNode',
                        mapPermissionToPermissionConnectionNode,
                        permissionSummaryNodeFields
                    )
            ),
        },
        categoryNode: {
            node: new Lazy<NodeDataLoader<Category, CategorySummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Category,
                        'CategoryConnectionNode',
                        mapCategoryToCategoryConnectionNode,
                        categoryConnectionNodeFields
                    )
            ),
        },
        ageRangeNode: {
            node: new Lazy<NodeDataLoader<AgeRange, AgeRangeConnectionNode>>(
                () =>
                    new NodeDataLoader(
                        AgeRange,
                        'AgeRangeConnectionNode',
                        mapAgeRangeToAgeRangeConnectionNode,
                        ageRangeNodeFields
                    )
            ),
        },
    }
}
