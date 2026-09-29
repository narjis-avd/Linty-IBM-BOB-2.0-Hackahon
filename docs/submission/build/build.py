"""Fill measured numbers from the Bob run report, then render slides PDF + cover PNG with headless Chrome."""
import json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent
REPORT = HERE.parents[2] / "public" / "reports" / "cart-total.json"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
VERCEL_URL = sys.argv[1] if len(sys.argv) > 1 else "linty.vercel.app"

values = {"VERCEL_URL": VERCEL_URL}
if REPORT.exists():
    r = json.loads(REPORT.read_text(encoding="utf-8"))
    v, d, t = r.get("verification"), r.get("detection"), r.get("timings")
    values.update({
        "ISSUES": str(len(r["analysis"]["errors"])),
        "FIXED": str(len(r["fix"]["fixes"])),
        "TESTS": str(v["fixed"]["total"]) if v else "–",
        "ORIG_PASS": str(v["original"]["passed"]) if v else "–",
        "FIXED_PASS": str(v["fixed"]["passed"]) if v else "–",
        "CAUGHT": str(d["caught"]) if d else "–",
        "EXPECTED": str(d["expected"]) if d else "–",
        "TIME": (f"{t['totalMs'] / 60000:.1f} min" if t["totalMs"] >= 60000 else f"{t['totalMs'] / 1000:.0f}s") if t else "1 task",
    })
else:
    print("WARNING: no Bob report yet; numbers left as dashes")

fill = lambda text: re.sub(r"\{\{(\w+)\}\}", lambda m: values.get(m.group(1), "–"), text)

html = fill((HERE / "slides.html").read_text(encoding="utf-8"))
(HERE / "slides.filled.html").write_text(html, encoding="utf-8")
# Cover = the title slide on its own.
cover = re.sub(r"(<!-- 2\. Problem -->).*(</body>)", r"\2", html, flags=re.S)
(HERE / "cover.filled.html").write_text(cover, encoding="utf-8")

common = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=4000"]
subprocess.run(common + [f"--print-to-pdf={OUT / 'Linty-slides.pdf'}", "--no-pdf-header-footer",
                         (HERE / "slides.filled.html").as_uri()], check=True, capture_output=True)
subprocess.run(common + ["--window-size=1920,1080", f"--screenshot={OUT / 'Linty-cover.png'}",
                         (HERE / "cover.filled.html").as_uri()], check=True, capture_output=True)

# Same filled numbers into the submission text.
sub = OUT / "SUBMISSION.md"
sub.write_text(fill(sub.read_text(encoding="utf-8")), encoding="utf-8") if REPORT.exists() else None
print("Built", OUT / "Linty-slides.pdf", "and", OUT / "Linty-cover.png")
