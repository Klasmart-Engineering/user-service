import { getConnection } from 'typeorm'

const PERMISSION_CACHE_KEY = 'user_permissions_cache'
export const PERMISSION_CACHE_DURATION_MS = 10000 // 10s

export class Cache {
    public static async clearAll() {
        await getConnection().queryResultCache?.clear()
    }

    public static async clearPermissionCache(userId: string) {
        await getConnection().queryResultCache?.remove([
            Cache.getUniquePermissionCacheKey(userId),
        ])
    }

    public static getUniquePermissionCacheKey(userId: string): string {
        return `${PERMISSION_CACHE_KEY}_${userId}`
    }
}
