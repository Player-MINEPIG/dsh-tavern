# Independent Prompt Assembler integration

[中文](ASSEMBLER_INTEGRATION.md) · [Assembly behavior](REQUEST_ASSEMBLY_en.md)

The production dependency is `Tavern → dsh-prompt-assembler`. The assembler has no package dependency on Tavern or Memory Manager. Its adapters receive their public read-only interfaces. Adapters belong to the assembler repository and are extended through forks or PRs; sources retain ownership of state and permissions.

## Using this candidate

The independent assembler `0.1.0` has not been published. For source development, place its checkout in `.local/dsh-prompt-assembler`, then run `npm ci` and `npm run check`. This local development dependency is excluded from Tavern Git and npm package contents.

```sh
node scripts/pack-with-assembler.mjs --assembler .local/dsh-prompt-assembler --output .local/packages
# Install both candidates into the dependency directory of the intended test profile.
npm install /path/to/dsh-prompt-assembler-0.1.0.tgz /path/to/pmp-dsh-tavern-2.5.1.tgz
```

Packaging fixes Tavern's dependency to `dsh-prompt-assembler:0.1.0`. The candidate still shares the stable 2.5.1 version label; this is not a published replacement. Identify it by its delivery receipt and Git commit. Use the existing secure DSH profile installation procedure, preserving configuration, credentials and data. Package installation alone does not install the assembly core extension; see the [core preparation boundary](REQUEST_ASSEMBLY_en.md).

## Tavern's integration seam

Tavern supplies current assets and world-book policy checks to the assembler store, registry and runtime. It prepares resources before assembly and validates leases afterwards. The service is `dshPromptSources`, with legacy `tavernRequestSources` and package-entry forwarding. HTTP remains behind Tavern's authentication/origin/desktop-token boundary. UI receives Tavern's secure fetch, locale and Trace URL. Selection, play/native defaults, child-session inheritance, Trace owner and storage format remain compatible.

The assembler owns adapters for presets, characters, personas, world books, PHI, custom text, templates and MVU registration. Tavern retains resource state, its restricted EJS runtime and MVU commit path. Adapters do not duplicate source state or read private files. The Manager adapter calls public requestAssemblyResources and trigger; the Manager continues to own management configuration and retrieval policies.

Sources implementing parseText process user text through inputMode:'text'; default mode reads source resources. Both share position, depth, roles and snapshots. Third parties own their language, Tavern uses ST parsing, and DSH custom text uses native variable interpolation. Skills are not injected twice.

Module sources and text parsers use separate add controls. Sources without current independent content do not appear as modules; parseText remains available for authored text. Tavern templates use their own read-only EJS parser; stored templates, MVU and Manager modules reflect actual bindings/configuration. Memory Manager reads borrow persisted cold sessions through withSessionRead without creating Agents or appending history. Missing sessions, reader initialization and read failures remain distinct.

## GitHub and distribution

Use separate repositories and package.json dependencies for the one-way package dependency. Document package dependencies separately from injected runtime interfaces. GitHub Dependency Graph reads manifests and lockfiles; a submodule is unnecessary. Once the assembler is published, replace Tavern's local file dependency with its exact npm version and regenerate the lockfile with npm. Users can then install Tavern and receive its dependency automatically. The current local candidate uses a paired-package installation.

Publish assembler before Tavern. This task does not create a remote repository, push or publish packages.
