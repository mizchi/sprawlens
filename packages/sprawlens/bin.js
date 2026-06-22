#!/usr/bin/env node
// Thin wrapper: `@sprawlens/cli`'s entry runs commander at import time, so
// importing it is the whole CLI. This package exists to claim the bare
// `sprawlens` name on npm and give users `npx sprawlens` without the scope.
import "@sprawlens/cli";
