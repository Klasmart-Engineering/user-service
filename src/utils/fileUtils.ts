import { FileUpload } from 'graphql-upload'

export function extensionForFile(file: FileUpload): string | undefined {
    const mimetype = file.mimetype

    let fileExt: string | undefined

    const matchRes = mimetype.match(/[^/]+$/)
    if (matchRes) {
        fileExt = matchRes[0]
    }
    return fileExt
}
