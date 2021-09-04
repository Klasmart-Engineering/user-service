export const CSV_MIMETYPES = [
    `text/csv`,
    `text/x-csv`,
    `application/x-csv`,
    `application/csv`,
    `text/x-comma-separated-values`,
    `text/comma-separated-values`,
    `.csv`,
] as const

export type CsvMimeType = typeof CSV_MIMETYPES[number]

export const CSV_MAX_FILESIZE = 50 * 1024
