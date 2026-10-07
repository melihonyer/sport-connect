# Sentinel-2 cloudless 2016 (EOX, CC BY 4.0) uydu kesiti: merkez + zoom → 1080×1350 JPG.
# Atıf: "Sentinel-2 cloudless – s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)"
import math, subprocess, io, sys, json, os
from PIL import Image, ImageEnhance, ImageFilter
W, H = 1080, 1350
def px(lat, lon, z):
    n = 256 * 2**z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
def fetch(name, lat, lon, z, scale=1.0):
    cx, cy = px(lat, lon, z)
    w, h = W / scale, H / scale
    x0, y0 = cx - w / 2, cy - h / 2
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int((x0 + w) // 256), int((y0 + h) // 256)
    m = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            cache = f"cache/{z}_{tx}_{ty}.jpg"
            if not os.path.exists(cache):
                os.makedirs("cache", exist_ok=True)
                subprocess.run(["curl", "-sf", "-o", cache, f"https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{ty}/{tx}.jpg"], check=True)
            m.paste(Image.open(cache).convert("RGB"), ((tx - tx0) * 256, (ty - ty0) * 256))
    ox, oy = x0 - tx0 * 256, y0 - ty0 * 256
    im = m.crop((round(ox), round(oy), round(ox + w), round(oy + h))).resize((W, H), Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.12)
    im = ImageEnhance.Color(im).enhance(1.05)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    im.save(f"sat/{name}.jpg", quality=92)
    return lambda la, lo: tuple(round((v - o) * scale) for v, o in zip(px(la, lo, z), (x0, y0)))
if __name__ == "__main__":
    spec = json.load(open("places.json"))
    out = {}
    for p in spec:
        f = fetch(p["id"], p["lat"], p["lon"], p["z"], p.get("scale", 1.0))
        out[p["id"]] = {k: f(*v) for k, v in p["marks"].items()}
        print(p["id"], out[p["id"]])
    json.dump(out, open("sat/marks.json", "w"), indent=1)
