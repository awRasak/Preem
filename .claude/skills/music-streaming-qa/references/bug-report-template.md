# Bug Report Template

Use this structure for every issue found during live testing. Keep it tight — enough detail to reproduce and triage, not a novel.

```
### [Severity] Short descriptive title

**Area**: (e.g., Playback / Queue / PWA-Offline / Accessibility / Responsive / Auth)
**Environment**: Browser + version, OS, viewport size, network condition (if relevant)
**Steps to reproduce**:
1. ...
2. ...
3. ...

**Expected**: what should happen
**Actual**: what actually happens
**Notes**: screenshots/console errors/anything that helps a dev fix it fast. Note if intermittent vs. 100% reproducible.
```

## Severity definitions (use consistently)

- **Blocker** — core flow unusable (can't play music, app crashes/white-screens, can't log in). Ship-stopping.
- **Critical** — a major feature is broken with no reasonable workaround (queue doesn't persist, offline downloads don't play).
- **Major** — noticeably degrades the experience but the app is still usable (seek bar inaccurate, shuffle repeats tracks, volume resets unexpectedly).
- **Minor** — annoying, doesn't block any flow (icon misaligned on hover, tooltip text typo).
- **Cosmetic** — pure visual polish (inconsistent spacing, slightly wrong shade of color).

## Report structure for a full pass

1. **Summary**: one paragraph — what was tested, overall health assessment.
2. **Bug list**, grouped by severity (Blocker first), each using the template above.
3. **Passed / verified** section: brief bullet list of what was checked and worked, so scope is clear.
4. **Coverage summary**: what wasn't tested and why (no access to X, out of scope, needs a specific device not available, etc).
