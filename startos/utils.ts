// Here we define any constants or functions that are shared by multiple components
// throughout the package codebase. This file will be unnecessary for many packages.

export const uiPort = 80

// S3/MinIO bucket naming contract: 3-63 chars, lowercase letters, numbers,
// dots or hyphens, starting and ending with a letter or number.
export const bucketNamePattern = '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
