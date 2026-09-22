#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const groups = [
  {
    name: 'Trace v3 primitives and real Host acceptance',
    files: [
      'test/trace-v3.test.mjs',
      'test/trace-v3-host.test.mjs',
      'test/trace-failures.test.mjs',
      'test/trace-failures-host.test.mjs',
    ],
  },
  {
    name: 'DSH V4 coordinates and Trace compatibility',
    files: ['test/dsh017-host-migration.test.mjs', 'test/dsh017-client-sessions.test.mjs', 'test/dsh017-client-surface-navigation.test.mjs', 'test/preset-parameter-fallback.test.mjs', 'test/preset-fallback-host.test.mjs', 'test/resource-capabilities.test.mjs', 'test/session-coordinates.test.mjs', 'test/coordinate-migration-integration.test.mjs', 'test/tavern-trace.test.mjs'],
  },
  {
    name: 'P0 complete history and cursor guards',
    files: ['test/play-history-pagination.test.mjs'],
  },
  {
    name: 'P0 catalog/timeline validation, CAS, focus and path hardening',
    files: [
      'test/play-timeline.test.mjs',
      'test/play-workspace.test.mjs',
      'test/play-client-cas.test.mjs',
      'test/play-cas-callers.test.mjs',
      'test/play-sessions.test.mjs',
      'test/play-client-contract.test.mjs',
    ],
  },
  {
    name: 'P0 import claim/lineage and privacy-safe lifecycle logging',
    files: [
      'test/import-context-runtime.test.mjs',
      'test/pending-input-projection.test.mjs',
      'test/play-import-context-session.test.mjs',
      'test/play-operation-log.test.mjs',
      'test/play-file-mutation-log.test.mjs',
      'test/play-session-import-log.test.mjs',
      'test/play-swipe-controller.test.mjs',
    ],
  },
  {
    name: 'P1 chrome service, transport, slot ownership and workspace admission',
    files: [
      'test/play-chrome.test.mjs',
      'test/play-chrome-client.test.mjs',
      'test/play-chrome-service.test.mjs',
      'test/play-chrome-transport.test.mjs',
      'test/play-slot-occupancy.test.mjs',
      'test/tavern-integration.test.mjs',
      'test/client-shell.test.mjs',
      'test/play-workspace-setting.test.mjs',
    ],
  },
  {
    name: 'release localization and installer/package boundaries',
    files: [
      'test/i18n.test.mjs',
      'test/scripts.test.mjs',
    ],
  },
]

for (const group of groups) {
  console.log(`\n=== ${group.name} ===`)
  const result = spawnSync(process.execPath, ['--test', ...group.files], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
