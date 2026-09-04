/**
 * @deprecated — legacy Neon-backed quota store removed.
 * Re-exports redis-quota for backward compatibility.
 * New code must import from "@/lib/redis-quota" directly.
 */
export {
  getDailyCountAsync,
  incrementDailyAsync,
  hasDailyCapacityAsync,
  getDailyCountSync,
  incrementDailySync,
  hasDailyCapacitySync,
  resetDailyQuotaStore,
  clearDailyQuota,
  saturateDailyCountSync,
  saturateDailyCountAsync,
  isRedisEnabled,
} from "./redis-quota";
