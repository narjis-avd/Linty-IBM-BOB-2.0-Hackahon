"""Assemble the Linty demo video: slides + Bob run recording + web app, with 5-voice narration.

usage: python make_video.py <bob_recording.mp4> <webapp_base_url> <proof_sentence>
"""
import asyncio, json, re, subprocess, sys
from pathlib import Path

import edge_tts
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = Path(__file__).parent
OUT = HERE.parent
TMP = HERE / "video_tmp"
TMP.mkdir(exist_ok=True)
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
FONT = "C\\:/Windows/Fonts/segoeuib.ttf"
W, H, FPS = 1920, 1080, 30

bob_recording = Path(sys.argv[1])
web = sys.argv[2].rstrip("/")
proof = sys.argv[3]


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def duration(path):
    out = subprocess.run([FF, "-i", str(path)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def shot(url, dest, budget=6000):
    run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--virtual-time-budget={budget}",
         f"--window-size={W},{H}", f"--screenshot={dest}", url])


# 1. Voices
items = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
async def tts():
    for it in items:
        text = it["text"].replace("{{PROOF_SENTENCE}}", proof)
        await edge_tts.Communicate(text, it["voice"], rate="+6%").save(str(TMP / f"{it['id']}.mp3"))
asyncio.run(tts())
audio = {it["id"]: TMP / f"{it['id']}.mp3" for it in items}

# 2. Stills: slides (one section per page) and web app tabs
slides_html = (HERE / "slides.filled.html").read_text(encoding="utf-8")
head, body = slides_html.split("<body>", 1)
sections = re.findall(r"<section.*?</section>", body, flags=re.S)
for i in (0, 1, 2, 3, 9):
    page = HERE / f"slide{i + 1}.html"
    page.write_text(f"{head}<body>{sections[i]}</body></html>", encoding="utf-8")
    shot(page.as_uri(), TMP / f"slide{i + 1}.png")
for tab in ("issues", "fixed", "tests", "report"):
    shot(f"{web}/#run=cart-total&tab={tab}", TMP / f"web-{tab}.png", budget=9000)


# 3. Segments, all encoded identically so they concat cleanly
def still(img, secs, out, voice=None, caption=None):
    vf = f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x0B0F1A,format=yuv420p"
    if caption:
        vf += (f",drawbox=x=0:y=ih-110:w=iw:h=110:color=0x0B0F1A@0.85:t=fill,"
               f"drawtext=fontfile='{FONT}':text='{caption}':fontcolor=0x00E0FF:fontsize=40:x=(w-tw)/2:y=h-78")
    args = [FF, "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(img)]
    args += ["-i", str(voice)] if voice else ["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono"]
    args += ["-t", f"{secs:.2f}", "-vf", vf, "-af", "apad", "-c:v", "libx264", "-preset", "veryfast", "-r", str(FPS),
             "-c:a", "aac", "-ar", "24000", "-ac", "1", "-shortest", str(out)]
    run(args)


def clip(video, secs, out, voice, caption):
    speed = max(duration(video) / secs, 1.0)
    vf = (f"setpts=PTS/{speed:.4f},scale={W}:{H}:force_original_aspect_ratio=decrease,"
          f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x0B0F1A,fps={FPS},format=yuv420p,"
          f"drawbox=x=0:y=ih-110:w=iw:h=110:color=0x0B0F1A@0.85:t=fill,"
          f"drawtext=fontfile='{FONT}':text='{caption}':fontcolor=0x00E0FF:fontsize=40:x=(w-tw)/2:y=h-78")
    run([FF, "-y", "-i", str(video), "-i", str(voice), "-t", f"{secs:.2f}", "-map", "0:v", "-map", "1:a",
         "-vf", vf, "-af", "apad", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-ar", "24000", "-ac", "1",
         str(out)])


pad = 0.8
segs = []
def seg(name):
    p = TMP / f"{len(segs):02d}-{name}.mp4"
    segs.append(p)
    return p

still(OUT / "Linty-cover.png", 3.5, seg("title"))
still(TMP / "slide2.png", duration(audio["01-problem"]) + pad, seg("problem"), audio["01-problem"])
still(TMP / "slide3.png", duration(audio["02-solution"]) + pad, seg("solution"), audio["02-solution"])
still(TMP / "slide4.png", duration(audio["03-bob"]) + pad, seg("bob"), audio["03-bob"])
# Live Bob run: at least 60 s on screen, sped up if the real run was longer.
demo_secs = duration(audio["04-demo"]) + pad
demo = TMP / "demo-silent.mp4"
halves = []
for i, (img, cap) in enumerate(((TMP / "web-issues.png", "Real IBM Bob run  -  Analyzer found 5 issues"), (TMP / "web-fixed.png", "Fixer patch  -  original vs fixed"))):
    part = TMP / f"demo-{i}.mp4"
    still(img, demo_secs / 2, part, caption=cap)
    halves.append(part)
(TMP / "demo.txt").write_text("".join(f"file '{p.as_posix()}'" + chr(10) for p in halves))
run([FF, "-y", "-f", "concat", "-safe", "0", "-i", str(TMP / "demo.txt"), "-c", "copy", str(demo)])
run([FF, "-y", "-i", str(demo), "-i", str(audio["04-demo"]), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "apad",
     "-t", f"{demo_secs:.2f}", "-c:a", "aac", "-ar", "24000", "-ac", "1", str(seg("bob-run"))])
# Proof narration spread across the four web app tabs.
proof_len = duration(audio["05-proof"]) + pad
proof_full = TMP / "proof-web.mp4"
parts = []
for i, tab in enumerate(("tests", "report", "tests", "report")):
    part = TMP / f"web-{i}.mp4"
    still(TMP / f"web-{tab}.png", proof_len / 4, part, caption=f"Linty dashboard  -  {tab}")
    parts.append(part)
lst = TMP / "web.txt"
lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
run([FF, "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(TMP / "web-silent.mp4")])
run([FF, "-y", "-i", str(TMP / "web-silent.mp4"), "-i", str(audio["05-proof"]), "-map", "0:v", "-map", "1:a",
     "-c:v", "copy", "-af", "apad", "-t", f"{proof_len:.2f}", "-c:a", "aac", "-ar", "24000", "-ac", "1", str(seg("proof"))])
still(TMP / "slide10.png", 5, seg("end"), caption="Voiceover generated with Microsoft Edge neural TTS  -  built with IBM Bob")

lst = TMP / "all.txt"
lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in segs))
final = OUT / "Linty-demo.mp4"
run([FF, "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(final)])
total = duration(final)
print(f"Built {final}  ({total:.1f}s)")
if total > 180:
    print("WARNING: over 3:00")
