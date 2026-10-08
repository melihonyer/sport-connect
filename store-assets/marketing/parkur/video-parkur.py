# "Parkurlar" video karuseli — birleştirme (8 Ekim 2026). video-parkur.mjs'in çizdiği saydam
# yazı/çizim katmanını alttaki görüntünün üstüne bindirip her kareyi MP4'e yazar.
#   map   : sat/<id>@2x.jpg, hedef nokta sabit kalacak şekilde yavaş yaklaşma (%16)
#   video : video/<id>.mov kesiti (drone) → yumuşak geçiş → foto/<id>.jpg'ye yavaş yaklaşma
#   photo : yalnız fotoğraf (Aladağlar), yavaş yaklaşma
#   end   : katman zaten opak (Deep Teal zemin)
# Kullanım: python3 video-parkur.py [kare no…]  → ../out/parkur-video-tr/NN.mp4
import json, math, os, subprocess, sys
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1350, 30
OUT = os.path.join(HERE, "..", "out", "parkur-video-tr")
OV = os.path.join(HERE, ".tmp", "ov")
MARKS = json.load(open(os.path.join(HERE, "sat", "marks.json")))
MARK = {"kapadokya": "goreme", "kackar": "zirve", "tahtali": "zirve", "alanya": "kale", "aladaglar": "demirkazik"}
os.makedirs(OUT, exist_ok=True)

def ease(t):  # yumuşak başla, yumuşak dur
    t = min(1.0, max(0.0, t))
    return 0.5 - 0.5 * math.cos(math.pi * t)

def overlay(n, k, frames):
    return Image.open(os.path.join(OV, f"{n:02d}", f"{min(k, frames - 1):04d}.png")).convert("RGBA")

def match(src, ref):
    """Bir üst zoom'un EOX karoları daha açık/sarı geliyor: kanal başına ortalama ve sapmayı
    PNG karuseldeki (1x) görüntüye eşitle, iki hal aynı renkte dursun."""
    from PIL import ImageStat
    a, b = ImageStat.Stat(src.resize(ref.size)), ImageStat.Stat(ref)
    bands = [ch.point(lambda v, m1=a.mean[i], s1=a.stddev[i], m2=b.mean[i], s2=b.stddev[i]: (v - m1) * s2 / s1 + m2)
             for i, ch in enumerate(src.split())]
    return Image.merge("RGB", bands)

def sat_frames(s):
    src = Image.open(os.path.join(HERE, "sat", f"{s['id']}@2x.jpg")).convert("RGB")
    src = match(src, Image.open(os.path.join(HERE, "sat", f"{s['id']}.jpg")).convert("RGB"))
    tx, ty = MARKS[s["id"]][MARK[s["id"]]]
    N = int(s["T"] * FPS)
    for k in range(N):
        z = 1 + 0.16 * ease(k / (N - 1))
        # hedef nokta ekranda aynı yerde kalsın: kutunun sol üstü = hedef - hedef/z
        x0, y0 = tx - tx / z, ty - ty / z
        box = (2 * x0, 2 * y0, 2 * (x0 + W / z), 2 * (y0 + H / z))
        yield src.resize((W, H), Image.LANCZOS, box=box)

def cover(img, pos):
    """object-fit: cover + object-position (yüzde) → W×H kutusuna sığan büyük görsel ve ofset."""
    px, py = (float(v.rstrip("%")) / 100 for v in pos.split())
    sc = max(W / img.width, H / img.height)
    return sc, px, py

def photo_frame(img, pos, z):
    sc, px, py = cover(img, pos)
    sc *= z
    vw, vh = W / sc, H / sc  # görüntülenen alan, kaynak pikselinde
    vw, vh = min(vw, img.width), min(vh, img.height)  # kayan nokta payı
    x0 = max(0.0, (img.width - vw) * px)
    y0 = max(0.0, (img.height - vh) * py)
    return img.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + vw, y0 + vh))

def clip_frames(s):
    c = s["clip"]
    vf = f"fps={FPS},scale=-2:{H}:flags=lanczos,crop={W}:{H},eq=contrast=1.04:saturation=1.06"
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(c["ss"]), "-t", str(c["dur"] + 0.2), "-i",
                          os.path.join(HERE, "video", f"{s['id']}.mov"), "-vf", vf, "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    last = None
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3:
            break
        last = Image.frombytes("RGB", (W, H), b)
        yield last
    p.kill()
    while True:  # kesit erken biterse son kareyi tut
        yield last

def video_frames(s):
    img = ImageOps.exif_transpose(Image.open(os.path.join(HERE, "foto", f"{s['id']}.jpg"))).convert("RGB")
    N = int(s["T"] * FPS)
    if s["kind"] == "photo":
        for k in range(N):
            yield photo_frame(img, s["pos"], 1 + 0.12 * ease(k / (N - 1)))
        return
    c = s["clip"]
    drone = clip_frames(s)
    x0, x1 = c["dur"] - c["xfade"], c["dur"]
    for k in range(N):
        t = k / FPS
        if t < x0:
            yield next(drone)
            continue
        # fotoğraf geçişin başından sona kadar yavaşça yaklaşır
        ph = photo_frame(img, s["pos"], 1 + 0.08 * ease((t - x0) / (s["T"] - x0)))
        if t < x1:
            yield Image.blend(next(drone), ph, ease((t - x0) / c["xfade"]))
        else:
            yield ph

def end_frames(s):
    N = int(s["T"] * FPS)
    for k in range(N):
        yield None

def render(s):
    n, frames = s["n"], s["frames"]
    out = os.path.join(OUT, f"{n:02d}.mp4")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
                           stdin=subprocess.PIPE)
    gen = {"map": sat_frames, "video": video_frames, "photo": video_frames, "end": end_frames}[s["kind"]](s)
    for k, base in enumerate(gen):
        ov = overlay(n, k, frames)
        fr = ov if base is None else Image.alpha_composite(base.convert("RGBA"), ov)
        enc.stdin.write(fr.convert("RGB").tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"out/parkur-video-tr/{n:02d}.mp4")

slides = json.load(open(os.path.join(OV, "slides.json")))
only = [int(a) for a in sys.argv[1:]]
for s in slides:
    if not only or s["n"] in only:
        render(s)
