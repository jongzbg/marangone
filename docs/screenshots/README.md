# Screenshots

Drop PNG/JPG screenshots here for the README gallery. Recommended workflow:

1. **Capture**: Use browser dev tools or `npx playwright` to take screenshots in 1280×800 viewport.
2. **Optimize**: Run through `cwebp -q 80` or `pngquant` to keep each file ≤300KB.
3. **Name**: Match the slot in `README.md` table — `login.png`, `feed.png`, etc.

## Quick capture recipe (Chrome DevTools)

```bash
# Open the running app
open http://localhost:3000

# In DevTools → Toggle device toolbar (Cmd/Ctrl+Shift+M)
# Set viewport → 1280×800
# Capture full page: Cmd/Ctrl+Shift+P → "Capture full size screenshot"
```

## File checklist (6 screenshots)

- [ ] `login.png` — login page (with demo creds hint visible)
- [ ] `feed.png` — home feed with sample posts
- [ ] `compose.png` — post composer with image/video options
- [ ] `chat.png` — real-time chat with conversation list + unread badges
- [ ] `profile.png` — user profile with stats
- [ ] `notifications.png` — notification feed

The README references these via relative paths, so as soon as files exist the gallery renders.
