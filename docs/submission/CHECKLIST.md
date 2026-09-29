# Final checklist (Mujtaba submits: team leader only)

Deadline: **8:00 PM PKT today**. Aim to press Submit by **7:15 PM**.

## Before submitting
- [ ] Repo is public and opens in an incognito window
- [ ] `vercel deploy --prod --yes --project linty` done; URL opens in incognito on phone + laptop, with no login
- [ ] At least one real Bob run is listed in the web app
- [ ] `bob_sessions/` has a PNG + exported .md from **every one of the 6 members**
- [ ] Secret scan is clean (run from the repo root):
      `git grep -nIiE "(api[_-]?key|secret|token|password|bearer|apikey)\s*[:=]" -- . ':!*.md' ':!.env.example'`
- [ ] `elevenlabs.key` is NOT inside the repo folder

## Form fields (copy from SUBMISSION.md)
- [ ] Title
- [ ] Short description (≤255 characters)
- [ ] Long description (≤500 words, count it)
- [ ] IBM Bob usage statement (≤500 words, count it)
- [ ] Tags: IBM, IBM Bob …
- [ ] Repo URL, app URL, platform = Vercel
- [ ] Cover image: `Linty-cover.png`
- [ ] Video: `Linty-demo.mp4` (≤3:00, ≥90 s demo, Bob visible)
- [ ] Slides: `Linty-slides.pdf`

## After submitting
- [ ] Reopen the submission and confirm every field saved
- [ ] Update the lablab team page idea to "Linty"
- [ ] All 6 fill in the post-hackathon feedback form when it arrives
- [ ] Rotate the ElevenLabs API key (it was pasted into a chat)
