import { EntityManager } from 'typeorm'
import { GradeRow } from '../../types/csv/gradeRow'

export async function processGradeFromCSVRow(
    manager: EntityManager,
    row: GradeRow,
    rowNumber: number
) {}
