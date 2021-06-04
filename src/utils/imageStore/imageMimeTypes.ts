function tupleArray<T extends any[]>(...v: T) {
    return v
}
const IMAGE_MIMETYPES_INFERRED = tupleArray(
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp'
) // INFERRED AS [string, string, string, string]

export const IMAGE_MIMETYPES: [
    string,
    string,
    string,
    string
] = IMAGE_MIMETYPES_INFERRED
