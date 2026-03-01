export default function handler(req: any, res: any) {
  // Lightweight deployment/version probe.
  // Intentionally avoids importing @vercel/node types to keep deps minimal.
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    now: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    git: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      commitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      repo: process.env.VERCEL_GIT_REPO_SLUG ?? null,
    },
  });
}
