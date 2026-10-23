// Copy to tgcloud/lib/secrets.js (git-ignored) and fill in. Both are optional.
// NVD API key (https://nvd.nist.gov/developers/request-an-api-key): raises NVD's
// limit from 5 to 50 requests per 30 s, so more CVE lookups fit in each run.
export const NVD_API_KEY = '';
// GitHub token with no scopes: raises the PoC search limit from 10 to 30 a minute.
export const GITHUB_TOKEN = '';
