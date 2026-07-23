/**
 * github-sync.mjs -- keep server/data/*.json backed up to GitHub so shop
  * data survives ephemeral filesystem resets on free hosting tiers (Render,
   * Railway, etc.) without needing a paid persistent disk or database.
    *
     * How it works:
      *  - Every time an admin creates/edits/deletes a product or gallery item,
       *    the updated JSON file is also committed to a dedicated branch in this
        *    GitHub repo (default: "shop-data"). That branch is separate from the
         *    deploy branch so saving data never triggers a redeploy.
          *  - On server boot, startup.mjs pulls the latest JSON straight from that
           *    branch and uses it to populate the (ephemeral) local data directory,
            *    so even a full disk wipe restores the real latest catalog instead of
             *    stale defaults from the last deploy.
              *
               * Required env vars (set in your hosting provider's dashboard):
                *   GITHUB_TOKEN       -- a GitHub Personal Access Token with read/write
                 *                         access to this repository's contents
                  *   GITHUB_REPO        -- "owner/repo", e.g. "nivdoronrl/Griffix_Racing"
                   *   GITHUB_DATA_BRANCH -- branch to sync data to/from (default: "shop-data")
                    *
                     * If GITHUB_TOKEN or GITHUB_REPO are not set, all functions below are
                      * no-ops and the app falls back to local-disk-only behavior.
                       */

                       const API_BASE = 'https://api.github.com';

                       export function githubSyncEnabled() {
                       return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
                       }

                       function branch() {
                       return process.env.GITHUB_DATA_BRANCH || 'shop-data';
                       }

                       async function githubFetch(path, options = {}) {
                       return fetch(API_BASE + path, {
                       ...options,
                       headers: {
                       Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
                       Accept: 'application/vnd.github+json',
                       'Content-Type': 'application/json',
                       ...(options.headers || {}),
                       },
                       });
                       }

                       export async function pullFromGitHub(repoPath) {
                       if (!githubSyncEnabled()) return null;

                       try {
                       const url = '/repos/' + process.env.GITHUB_REPO + '/contents/' + repoPath + '?ref=' + branch();
                       const res = await githubFetch(url);
                       if (!res.ok) return null;

                       const data = await res.json();
                       if (!data.content) return null;
                       return Buffer.from(data.content, 'base64').toString('utf-8');
                       } catch (err) {
                       console.error('[github-sync] pull failed for ' + repoPath + ':', err.message);
                       return null;
                       }
                       }

                       export async function pushToGitHub(repoPath, contents, message) {
                       if (!githubSyncEnabled()) return { skipped: true };

                       const repo = process.env.GITHUB_REPO;
                       const ref = branch();
                       const url = '/repos/' + repo + '/contents/' + repoPath;

                       try {
                       let sha;
                       const getRes = await githubFetch(url + '?ref=' + ref);
                       if (getRes.ok) {
                       const existing = await getRes.json();
                       sha = existing.sha;
                       }

                       const body = {
                       message: message || ('Update ' + repoPath),
                       content: Buffer.from(contents).toString('base64'),
                       branch: ref,
                       };
                       if (sha) body.sha = sha;

                       const putRes = await githubFetch(url, {
                       method: 'PUT',
                       body: JSON.stringify(body),
                       });

                       if (!putRes.ok) {
                       const errText = await putRes.text();
                       console.error('[github-sync] push failed for ' + repoPath + ':', errText);
                       return { ok: false };
                       }

                       return { ok: true };
                       } catch (err) {
                       console.error('[github-sync] push error for ' + repoPath + ':', err.message);
                       return { ok: false };
                       }
                       }
                       
