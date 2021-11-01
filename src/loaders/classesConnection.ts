import DataLoader from 'dataloader'
import { Class } from '../entities/class'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRange'
import { GradeSummaryNode } from '../types/graphQL/grade'
import { ProgramSummaryNode } from '../types/graphQL/program'
import { SchoolSummaryNode } from '../types/graphQL/school'
import { SubjectSummaryNode } from '../types/graphQL/subject'
import { SUMMARY_ELEMENTS_LIMIT } from '../types/paginationConstants'
import { SelectQueryBuilder } from 'typeorm'
import { School } from '../entities/school'
import { AgeRange } from '../entities/ageRange'
import { Grade } from '../entities/grade'
import { Subject } from '../entities/subject'
import { Program } from '../entities/program'
import { Lazy } from '../utils/lazyLoading'
import { NodeDataLoader } from './genericNode'
import { ClassSummaryNode } from '../types/graphQL/classSummaryNode'

export interface IClassesConnectionLoaders {
    schools: Lazy<DataLoader<string, SchoolSummaryNode[]>>
    ageRanges: Lazy<DataLoader<string, AgeRangeConnectionNode[]>>
    grades: Lazy<DataLoader<string, GradeSummaryNode[]>>
    subjects: Lazy<DataLoader<string, SubjectSummaryNode[]>>
    programs: Lazy<DataLoader<string, ProgramSummaryNode[]>>
}

export interface IClassNodeDataLoaders {
    node: Lazy<NodeDataLoader<Class, ClassSummaryNode>>
}

type ClassEntities =
    | 'schools'
    | 'age_ranges'
    | 'grades'
    | 'subjects'
    | 'programs'

type ClassEntityTypes = School | AgeRange | Grade | Subject | Program

const baseClassQuery = (ids: readonly string[]) => {
    return Class.createQueryBuilder('Class')
        .whereInIds(ids)
        .select('Class.class_id')
}

export const schoolsForClasses = async (
    classIds: readonly string[]
): Promise<SchoolSummaryNode[][]> => {
    const scope = baseClassQuery(classIds)
        .leftJoin('Class.schools', 'School')
        .addSelect(['School.school_id', 'School.school_name', 'School.status'])

    const classSchools = getNestedEntities(
        scope,
        classIds,
        'schools'
    ) as Promise<SchoolSummaryNode[][]>

    return classSchools
}

export const ageRangesForClasses = async (
    classIds: readonly string[]
): Promise<AgeRangeConnectionNode[][]> => {
    const scope = baseClassQuery(classIds)
        .leftJoin('Class.age_ranges', 'AgeRange')
        .addSelect([
            'AgeRange.id',
            'AgeRange.name',
            'AgeRange.status',
            'AgeRange.system',
            'AgeRange.low_value',
            'AgeRange.low_value_unit',
            'AgeRange.high_value',
            'AgeRange.high_value_unit',
        ])

    const classAgeRanges = getNestedEntities(
        scope,
        classIds,
        'age_ranges'
    ) as Promise<AgeRangeConnectionNode[][]>

    return classAgeRanges
}

export const gradesForClasses = async (
    classIds: readonly string[]
): Promise<GradeSummaryNode[][]> => {
    const scope = baseClassQuery(classIds)
        .leftJoin('Class.grades', 'Grade')
        .addSelect(['Grade.id', 'Grade.name', 'Grade.status', 'Grade.system'])

    const classGrades = getNestedEntities(scope, classIds, 'grades') as Promise<
        GradeSummaryNode[][]
    >

    return classGrades
}

export const subjectsForClasses = async (
    classIds: readonly string[]
): Promise<SubjectSummaryNode[][]> => {
    const scope = baseClassQuery(classIds)
        .leftJoin('Class.subjects', 'Subject')
        .addSelect([
            'Subject.id',
            'Subject.name',
            'Subject.status',
            'Subject.system',
        ])

    const classSubjects = getNestedEntities(
        scope,
        classIds,
        'subjects'
    ) as Promise<SubjectSummaryNode[][]>

    return classSubjects
}

export const programsForClasses = async (
    classIds: readonly string[]
): Promise<ProgramSummaryNode[][]> => {
    const scope = baseClassQuery(classIds)
        .leftJoin('Class.programs', 'Program')
        .addSelect([
            'Program.id',
            'Program.name',
            'Program.status',
            'Program.system',
        ])

    const classPrograms = getNestedEntities(
        scope,
        classIds,
        'programs'
    ) as Promise<ProgramSummaryNode[][]>

    return classPrograms
}

type ClassEntitySummaryTypes =
    | SchoolSummaryNode
    | AgeRangeConnectionNode
    | GradeSummaryNode
    | SubjectSummaryNode
    | ProgramSummaryNode

// gets the specified entity of classes
async function getNestedEntities(
    scope: SelectQueryBuilder<Class>,
    classIds: readonly string[],
    entityName: ClassEntities
) {
    const classes = await scope.getMany()

    const classIdPositions = new Map()
    for (const [index, classId] of classIds.entries()) {
        classIdPositions.set(classId, index)
    }

    const classesInRequestedOrder: ClassEntitySummaryTypes[][] = new Array(
        classIds.length
    )
    for (const class_ of classes) {
        const currentEntities: ClassEntitySummaryTypes[] = []
        const entities = (await class_[entityName]) || []

        let counter = 1
        for (const entity of entities) {
            currentEntities.push(buildEntityProps(entityName, entity))
            if (counter === SUMMARY_ELEMENTS_LIMIT) {
                break
            }
            counter += 1
        }
        classesInRequestedOrder[
            classIdPositions.get(class_.class_id)
        ] = currentEntities
    }

    return classesInRequestedOrder
}

// builds the props that each entity needs
function buildEntityProps(
    entityName: ClassEntities,
    entity: ClassEntityTypes
): ClassEntitySummaryTypes {
    let typedEntity
    let _exhaustiveCheck: never
    switch (entityName) {
        case 'schools':
            typedEntity = entity as School

            return {
                id: typedEntity.school_id,
                name: typedEntity.school_name,
                status: typedEntity.status,
            } as SchoolSummaryNode

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
            _exhaustiveCheck = entityName
            return _exhaustiveCheck
    }
}
