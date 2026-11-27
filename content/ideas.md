# Blog ideas

<!--
One topic per line:  - [ ] topic — optional notes
The Friday blog routine takes the first unticked line and uses the notes after
the "—". When it drafts a post it ticks the line and appends → /blog/<slug>.
Add your own ideas at the bottom, or edit the notes of one that's waiting.
This file is not rendered on the site. The repo is public, so don't put
anything here you wouldn't publish.
-->

- [ ] Pin your CDN URLs: how @latest can break production with no deploy — Write it as a lesson, not an incident: nothing broke for me, so do not claim it did. Starting point: the official MediaPipe Face Landmarker web example loads its WebAssembly runtime with FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"). The JS wrapper comes from npm at the version locked in package.json, but the WASM binary comes from whatever version the CDN calls latest that day. When a new release ships, the two stop matching and the feature can fail in production with no commit and no deploy. A lockfile cannot see a version that only lives inside a URL string. Two smaller costs of the same pattern: a CDN outage or a firewall that blocks the CDN (common on campus and office networks) takes the feature down, and every user sends a request to a third party. The fix: copy the wasm folder from node_modules into public/ with a postinstall script so it always matches the installed package, download the model file once and serve it yourself, add long immutable cache headers for those files, and load the library with a dynamic import so the multi-megabyte download only happens on the page that needs it. General rule to end on: search the codebase for @latest and unversioned CDN URLs, because each one is a dependency your lockfile does not know about.
