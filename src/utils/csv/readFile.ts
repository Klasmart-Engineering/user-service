import csv = require('csv-parser')
import { Upload } from '../../types/upload'
import { ReReadable } from 'rereadable-stream'
import { EntityManager } from 'typeorm'
import { CreateEntityRowCallback } from '../../types/csv/createEntityRowCallback'
import { Transform } from 'stream'
import { CSVError } from '../../types/csv/csvError'
import { stringInject } from '../stringUtils'
import constants from '../../types/errors/csv/csvErrorConstants'
import { UserPermissions } from '../../permissions/userPermissions'
import { CSV_MIMETYPES, CsvMimeType } from '../../types/csvFormat'
import * as Stream from 'stream'
import { customErrors } from '../../types/errors/customError'
import { CreateEntityHeadersCallback } from '../../types/csv/createEntityHeadersCallback'
import logger from '../../logging'
import { config } from '../../config/config'
import stream = require('stream')

function formatCSVRow(row: Record<string, unknown>) {
    const keys = Object.keys(row)
    const formattedValues = Object.values(row).map((value) => {
        return String(value).trim() || null
    })

    keys.forEach((key, index) => {
        Object.assign(row, { [key]: formattedValues[index] })
    })

    return row
}

function canFinish(
    index: number,
    callbacks: CreateEntityRowCallback[],
    stream: Transform
) {
    return index === callbacks.length - 1 && !stream.readableLength
}

function checkFileType(mimetype: string) {
    if (!CSV_MIMETYPES.includes(mimetype as CsvMimeType)) {
        throw Error(
            stringInject(customErrors.invalid_file_type.message, {
                fileType: 'CSV',
            })
        )
    }
}

function checkFileSize(
    readStream: Stream.Readable,
    maxSize: number,
    filename: string,
    fileErrors: CSVError[]
) {
    return new Promise<void>((resolve, reject) => {
        let byteLength = 0
        let fileHasData = false

        readStream.on('data', (chunk) => {
            fileHasData = true
            byteLength += chunk.length
            if (byteLength > maxSize) {
                reject(
                    Error(
                        stringInject(
                            constants.MSG_ERR_FILE_EXCEEDS_MAX_FILE_SIZE,
                            {
                                max: config.limits.CSV_MAX_FILESIZE / 1024,
                            }
                        )
                    )
                )
            }
        })

        function rejectIfNoData() {
            if (!fileHasData) {
                reject(
                    Error(
                        stringInject(constants.MSG_ERR_CSV_EMPTY_FILE, {
                            filename,
                        })
                    )
                )
            }
        }

        readStream.on('end', () => {
            readStream.removeAllListeners()
            rejectIfNoData()
            resolve()
        })

        readStream.on('close', () => {
            readStream.removeAllListeners()
            rejectIfNoData()
            resolve()
        })
        readStream.on('error', (err) => {
            readStream.removeAllListeners()
            reject(err)
        })
    })
}

async function checkHeaders(
    reReadable: ReReadable,
    headersCallback: CreateEntityHeadersCallback,
    filename: string,
    fileErrors: CSVError[]
) {
    const headersPromise = new Promise((resolve, reject) => {
        const csvStream = reReadable.rewind().pipe(csv())
        csvStream.on('headers', (headers) => {
            csvStream.removeAllListeners()
            resolve(headers)
        })
        csvStream.on('end', () => {
            csvStream.removeAllListeners()
            reject()
        })
        csvStream.on('close', () => {
            csvStream.removeAllListeners()
            reject()
        })
        csvStream.on('error', () => {
            csvStream.removeAllListeners()
            reject()
        })
    })

    const headers = await headersPromise
    await headersCallback(headers, filename, fileErrors)
}

async function validateFile(
    readStream: Stream.Readable,
    reReadable: ReReadable,
    headersCallback: CreateEntityHeadersCallback | undefined,
    filename: string,
    mimetype: string,
    fileErrors: CSVError[]
) {
    checkFileType(mimetype)

    await checkFileSize(
        readStream,
        config.limits.CSV_MAX_FILESIZE,
        filename,
        fileErrors
    )

    if (headersCallback) {
        await checkHeaders(reReadable, headersCallback, filename, fileErrors)
    }

    if (fileErrors.length) throw fileErrors
}

function decodeUtf8Callback(
    decode: () => string,
    callback: (error?: Error | undefined, data?: string) => void
): void {
    let decoded: string
    try {
        decoded = decode()
    } catch {
        callback(new Error(constants.MSG_ERR_CSV_FILE_ENCODING), undefined)
        return
    }
    callback(undefined, decoded)
    return
}

function decodeUtf8() {
    const decoder = new TextDecoder('utf-8', { fatal: true })

    return new stream.Transform({
        transform: (
            chunk: Buffer,
            _encoding: string,
            callback: Stream.TransformCallback
        ) => {
            return decodeUtf8Callback(
                () => decoder.decode(chunk, { stream: true }),
                callback
            )
        },
        flush: (callback) => {
            return decodeUtf8Callback(() => decoder.decode(), callback)
        },
    })
}

export async function readCSVFile(
    manager: EntityManager,
    file: Upload,
    rowCallbacks: CreateEntityRowCallback[],
    userPermissions: UserPermissions,
    headersCallback: CreateEntityHeadersCallback | undefined = undefined
) {
    // we don't respect the encoding the client claims and instead
    // always try to decode as UTF-8
    const { filename, mimetype, encoding } = file
    let rowCounter = 0
    let csvStream: Transform
    const fileErrors: CSVError[] = []
    const readStream = file.createReadStream().pipe(decodeUtf8())
    const rereadableStream = readStream.pipe(new ReReadable())

    await validateFile(
        readStream,
        rereadableStream,
        headersCallback,
        filename,
        mimetype,
        fileErrors
    )

    if (fileErrors.length) {
        throw fileErrors
    }

    for (let i = 0; i < rowCallbacks.length; i += 1) {
        csvStream = rereadableStream.rewind().pipe(csv())
        rowCounter = 0
        for await (let chunk of csvStream) {
            rowCounter += 1

            chunk = formatCSVRow(chunk)

            const rowErrors = await rowCallbacks[i](
                manager,
                chunk,
                rowCounter,
                fileErrors,
                userPermissions
            )

            fileErrors.push(...rowErrors)

            if (canFinish(i, rowCallbacks, csvStream)) {
                if (fileErrors.length) {
                    logger.error(
                        'These errors were found in the file: %o',
                        fileErrors
                    )
                    throw fileErrors
                }

                return {
                    mimetype,
                    encoding,
                    filename,
                }
            }
        }
    }
    if (rowCounter === 0) {
        throw new Error(
            stringInject(constants.MSG_ERR_CSV_EMPTY_FILE, {
                filename,
            })
        )
    }
}
