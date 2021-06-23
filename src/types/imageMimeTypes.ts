export const IMAGE_MIMETYPES = ['image/jpeg', 'image/png'] as const

export type ImageMimeType = typeof IMAGE_MIMETYPES[number]
