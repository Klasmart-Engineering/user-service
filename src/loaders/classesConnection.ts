import DataLoader from 'dataloader'
import { Class } from '../entities/class'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRangeConnectionNode'
import { GradeSummaryNode } from '../types/graphQL/gradeSummaryNode'
import { ProgramSummaryNode } from '../types/graphQL/programSummaryNode'
import { SchoolSimplifiedSummaryNode } from '../types/graphQL/schoolSimplifiedSummaryNode'
import { SubjectSummaryNode } from '../types/graphQL/subjectSummaryNode'
import {
    filterHasProperty,
    getWhereClauseFromFilter,
    IEntityFilter,
} from '../utils/pagination/filtering'
import { SUMMARY_ELEMENTS_LIMIT } from '../types/paginationConstants'
import { SelectQueryBuilder } from 'typeorm'
import { School } from '../entities/school'
import { AgeRange } from '../entities/ageRange'
import { Grade } from '../entities/grade'
import { Subject } from '../entities/subject'
import { Program } from '../entities/program'

export interface IClassesConnectionLoaders {
    schools?: DataLoader<string, SchoolSimplifiedSummaryNode[]>
    ageRanges?: DataLoader<string, AgeRangeConnectionNode[]>
    grades?: DataLoader<string, GradeSummaryNode[]>
    subjects?: DataLoader<string, SubjectSummaryNode[]>
    programs?: DataLoader<string, ProgramSummaryNode[]>
}

type ClassEntities =
    | 'schools'
    | 'age_ranges'
    | 'grades'
    | 'subjects'
    | 'programs'

type ClassEntityTypes = School | AgeRange | Grade | Subject | Program

export const schoolsForClasses = async (
    classIds: readonly string[],
    filter?: IEntityFilter
): Promise<SchoolSimplifiedSummaryNode[][]> => {
    const scope = await Class.createQueryBuilder('Class')
        .leftJoinAndSelect('Class.schools', 'School')
        .where('Class.class_id IN (:...ids)', { ids: classIds })

    if (filter) {
        addFilterJoins(filter, scope, 'schools')
    }

    const classSchools = getNestedEntities(
        scope,
        classIds,
        'schools'
    ) as Promise<SchoolSimplifiedSummaryNode[][]>

    return classSchools
}

export const ageRangesForClasses = async (
    classIds: readonly string[],
    filter?: IEntityFilter
): Promise<AgeRangeConnectionNode[][]> => {
    const scope = await Class.createQueryBuilder('Class')
        .leftJoinAndSelect('Class.age_ranges', 'AgeRange')
        .where('Class.class_id IN (:...ids)', { ids: classIds })

    if (filter) {
        addFilterJoins(filter, scope, 'age_ranges')
    }

    const classAgeRanges = getNestedEntities(
        scope,
        classIds,
        'age_ranges'
    ) as Promise<AgeRangeConnectionNode[][]>

    return classAgeRanges
}

export const gradesForClasses = async (
    classIds: readonly string[],
    filter?: IEntityFilter
): Promise<GradeSummaryNode[][]> => {
    const scope = await Class.createQueryBuilder('Class')
        .leftJoinAndSelect('Class.grades', 'Grade')
        .where('Class.class_id IN (:...ids)', { ids: classIds })

    if (filter) {
        addFilterJoins(filter, scope, 'grades')
    }

    const classGrades = getNestedEntities(scope, classIds, 'grades') as Promise<
        GradeSummaryNode[][]
    >

    return classGrades
}

export const subjectsForClasses = async (
    classIds: readonly string[],
    filter?: IEntityFilter
): Promise<SubjectSummaryNode[][]> => {
    const scope = await Class.createQueryBuilder('Class')
        .leftJoinAndSelect('Class.subjects', 'Subject')
        .where('Class.class_id IN (:...ids)', { ids: classIds })

    if (filter) {
        addFilterJoins(filter, scope, 'subjects')
    }

    const classSubjects = getNestedEntities(
        scope,
        classIds,
        'subjects'
    ) as Promise<SubjectSummaryNode[][]>

    return classSubjects
}

export const programsForClasses = async (
    classIds: readonly string[],
    filter?: IEntityFilter
): Promise<ProgramSummaryNode[][]> => {
    const scope = await Class.createQueryBuilder('Class')
        .leftJoinAndSelect('Class.programs', 'Program')
        .where('Class.class_id IN (:...ids)', { ids: classIds })

    if (filter) {
        addFilterJoins(filter, scope, 'programs')
    }

    const classPrograms = getNestedEntities(
        scope,
        classIds,
        'programs'
    ) as Promise<ProgramSummaryNode[][]>

    return classPrograms
}

// generates the needed joins when a filter is applied
function addFilterJoins(
    filter: IEntityFilter,
    scope: SelectQueryBuilder<Class>,
    entityName: ClassEntities
) {
    const columnAliases = {
        id: 'Class.class_id',
        name: 'Class.class_name',
        status: 'Class.status',
        organizationId: 'Organization.organization_id',
        ageRangeValueFrom: '',
        ageRangeUnitFrom: '',
        ageRangeValueTo: '',
        ageRangeUnitTo: '',
        schoolId: '',
        gradeId: '',
        subjectId: '',
        programId: '',
    }

    if (filterHasProperty('organizationId', filter)) {
        scope.leftJoinAndSelect('Class.organization', 'Organization')
    }

    if (
        entityName !== 'age_ranges' &&
        (filterHasProperty('ageRangeValueFrom', filter) ||
            filterHasProperty('ageRangeUnitFrom', filter) ||
            filterHasProperty('ageRangeValueTo', filter) ||
            filterHasProperty('ageRangeUnitTo', filter))
    ) {
        scope.leftJoinAndSelect('Class.age_ranges', 'AgeRange')
        columnAliases.ageRangeValueFrom = 'AgeRange.low_value'
        columnAliases.ageRangeUnitFrom = 'AgeRange.low_value_unit'
        columnAliases.ageRangeValueTo = 'AgeRange.high_value'
        columnAliases.ageRangeUnitTo = 'AgeRange.high_value_unit'
    }

    if (entityName !== 'schools' && filterHasProperty('schoolId', filter)) {
        scope.leftJoinAndSelect('Class.schools', 'School')
        columnAliases.schoolId = 'School.school_id'
    }

    if (entityName !== 'grades' && filterHasProperty('gradeId', filter)) {
        scope.leftJoinAndSelect('Class.grades', 'Grade')
        columnAliases.gradeId = 'Grade.id'
    }

    if (entityName !== 'subjects' && filterHasProperty('subjectId', filter)) {
        scope.leftJoinAndSelect('Class.subjects', 'Subject')
        columnAliases.subjectId = 'Subject.id'
    }

    if (entityName !== 'programs' && filterHasProperty('programId', filter)) {
        scope.leftJoinAndSelect('Class.programs', 'Program')
        columnAliases.programId = 'Program.id'
    }

    scope.andWhere(getWhereClauseFromFilter(filter, columnAliases))
}

// gets the specified entity of classes
async function getNestedEntities(
    scope: SelectQueryBuilder<Class>,
    classIds: readonly string[],
    entityName: ClassEntities
) {
    const classEntities = []
    const classes = await scope.getMany()

    for (const classId of classIds) {
        const class_ = classes.find((c) => c.class_id === classId)

        if (class_) {
            let counter = 0
            const currentEntities = []
            const entities = (await class_[entityName]) || []

            for (const entity of entities) {
                // summary elements have a limit
                if (counter === SUMMARY_ELEMENTS_LIMIT) {
                    break
                }

                counter += 1
                currentEntities.push(buildEntityProps(entityName, entity))
            }

            classEntities.push(currentEntities)
        } else {
            classEntities.push([])
        }
    }

    return classEntities
}

// builds the props that each entity needs
function buildEntityProps(entityName: ClassEntities, entity: ClassEntityTypes) {
    let typedEntity

    switch (entityName) {
        case 'schools':
            typedEntity = entity as School

            return {
                id: typedEntity.school_id,
                name: typedEntity.school_name,
                status: typedEntity.status,
            } as SchoolSimplifiedSummaryNode

        case 'age_ranges':
            typedEntity = entity as AgeRange

            return {
                id: typedEntity.id,
                name: typedEntity.name,
                status: typedEntity.status,
                system: typedEntity.system,
                lowValue: typedEntity.low_value,
                lowValueUnit: typedEntity.low_value_unit,
                highValue: typedEntity.high_value,
                highValueUnit: typedEntity.high_value_unit,
            } as AgeRangeConnectionNode

        case 'grades':
            typedEntity = entity as Grade

            return {
                id: typedEntity.id,
                name: typedEntity.name,
                status: typedEntity.status,
                system: typedEntity.system,
            } as GradeSummaryNode

        case 'subjects':
            typedEntity = entity as Subject

            return {
                id: typedEntity.id,
                name: typedEntity.name,
                status: typedEntity.status,
                system: typedEntity.system,
            } as SubjectSummaryNode

        case 'programs':
            typedEntity = entity as Program

            return {
                id: typedEntity.id,
                name: typedEntity.name,
                status: typedEntity.status,
                system: typedEntity.system,
            } as ProgramSummaryNode

        default:
            return {}
    }
}
