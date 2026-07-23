// Here we define any constants or functions that are shared by multiple components
// throughout the package codebase. This file will be unnecessary for many packages.

export const relayPort = 3000
export const healthPort = 8080
export const metricsPort = 9102
export const postgresPort = 5432
export const redisPort = 6379
export const minioPort = 9000
export const minioConsolePort = 9001

export const postgresUser = 'buzz'
export const postgresDb = 'buzz'

// S3/MinIO bucket naming contract: 3-63 chars, lowercase letters, numbers,
// dots or hyphens, starting and ending with a letter or number.
export const bucketNamePattern = '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
