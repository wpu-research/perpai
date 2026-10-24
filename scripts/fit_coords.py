"""perpa.com.tr harita koordinatlarını (arastirma/veri/koordinatlar.json) bizim kat modelimize taşır.

Her firmaya iki alan ekler (web/data/firms.json):
  p: [x, z]  modeldeki gerçek konumu (m)
  c: 'K'|'S'|'M'|'Y'  plandaki gerçek hat/avlu rengi (kırmızı, sarı, mavi, yeşil)

Yöntem:
  1. İzometrik plan görseli -> zemin düzlemi: 8 avlu asansörünün piksel merkezlerinden homografi.
  2. Blok başına parçalı doğrusal eşleme: dış dükkân şeridi, avlu merkezleri ve blok ortası
     modeldeki karşılıklarına oturtulur (model şematik, oranları gerçekle birebir değil).
  3. Hat rengi, firmanın plan görselindeki noktasından okunur.
"""
import colorsys, json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRMS = os.path.join(ROOT, 'web/data/firms.json')
COORDS = os.path.join(ROOT, 'arastirma/veri/koordinatlar.json')
PLANS = os.path.join(ROOT, 'arastirma/kat-planlari/floor-{}.jpg')
W, H_ = 4429, 2000

# Modelle aynı sabitler (web/js/layout.js)
HU, HV, STRIP, CROSS = 75, 50, 7, 2.5
CELL_HU, CELL_HV = (HU - STRIP - 6 - CROSS) / 2, (HV - STRIP - 6 - CROSS) / 2
BLOCK_CX = {'B': -85, 'A': 85}
OUT_U, OUT_V = HU - STRIP / 2, HV - STRIP / 2          # dış şerit dükkân merkezleri
AV_U, AV_V = CROSS + CELL_HU, CROSS + CELL_HV          # avlu merkezleri

# Asansör ikonlarının 10. kat planındaki piksel merkezleri (tüm katlarda kamera aynı)
#   blok, asansör no, (sol=-1/sağ=+1, arka=-1/ön=+1), piksel
ELEV = [
    ('B', 20, (-1, -1), (1170, 495)), ('B', 19, (1, -1), (1855, 655)),
    ('B', 13, (-1, 1), (890, 740)), ('B', 14, (1, 1), (1605, 915)),
    ('A', 18, (-1, -1), (2668, 850)), ('A', 17, (1, -1), (3500, 1030)),
    ('A', 15, (-1, 1), (2450, 1140)), ('A', 16, (1, 1), (3315, 1360)),
]


def fit_h(src, dst):
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(a, float))
    return vt[-1].reshape(3, 3) / vt[-1][-1]


def apply(h, p):
    q = h @ np.array([p[0], p[1], 1.0])
    return q[:2] / q[2]


def model_pt(blk, su, sv):
    return (BLOCK_CX[blk] + su * AV_U, sv * AV_V)


HM = fit_h([e[3] for e in ELEV], [model_pt(e[0], *e[2]) for e in ELEV])


def pw(x, xs, ys):
    """parçalı doğrusal, uçlarda doğrusal devam"""
    if x <= xs[0]:
        return ys[0] + (x - xs[0]) * (ys[1] - ys[0]) / (xs[1] - xs[0])
    if x >= xs[-1]:
        return ys[-1] + (x - xs[-1]) * (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])
    return float(np.interp(x, xs, ys))


def classify(img, px, py):
    """noktadaki hat rengi; gri/beyaz ise çevresine bakar"""
    for r in (0, 4, 8, 12, 18, 26):
        votes = {}
        for dx in range(-r, r + 1, max(1, r // 2) or 1):
            for dy in range(-r, r + 1, max(1, r // 2) or 1):
                x, y = int(px + dx), int(py + dy)
                if not (0 <= x < W and 0 <= y < H_):
                    continue
                rr, gg, bb = img.getpixel((x, y))[:3]
                hh, ss, vv = colorsys.rgb_to_hsv(rr / 255, gg / 255, bb / 255)
                if ss < 0.45 or vv < 0.35:
                    continue
                deg = hh * 360
                c = 'K' if (deg < 20 or deg > 330) else 'S' if deg < 65 else 'Y' if deg < 160 else 'M' if deg < 260 else None
                if c:
                    votes[c] = votes.get(c, 0) + 1
        if votes:
            return max(votes, key=votes.get)
    return None


# Kapı/merdiven ikonlarının 10. kat planındaki piksel merkezleri (yalnız layout.js'i güncellerken)
GATE_PX = {1: (1380, 1190), 2: (567, 975), 3: (244, 825), 4: (1085, 188), 5: (1417, 233), 6: (2109, 382),
           7: (2828, 580), 8: (3618, 758), 9: (3978, 834), 10: (3612, 1684), 11: (3120, 1690), 12: (2225, 1445)}


def to_model(knots, blk, q):
    (ux, uy), (vx, vy) = knots[blk]
    return pw(q[0], ux, uy), pw(q[1], vx, vy)


def main():
    data = json.load(open(FIRMS, encoding='utf-8'))
    coords = json.load(open(COORDS))
    raw = {}  # firma id -> (blok, homografi sonrası (x,z), piksel)
    for f in data['firms']:
        c = coords.get(str(f['i']))
        f.pop('p', None); f.pop('c', None)
        if not c or 'x' not in c or (c['x'] == 0 and c['y'] == 0):
            continue
        px = (c['x'] * W, c['y'] * H_)
        raw[f['i']] = (f['b'], apply(HM, px), px, c['f'])

    # blok başına düğüm noktaları
    knots = {}
    for blk in 'BA':
        ev = {e[2]: apply(HM, e[3]) for e in ELEV if e[0] == blk}
        cx = np.mean([p[0] for p in ev.values()]); cz = np.mean([p[1] for p in ev.values()])
        left = np.mean([ev[(-1, s)][0] for s in (-1, 1)]); right = np.mean([ev[(1, s)][0] for s in (-1, 1)])
        back = np.mean([ev[(s, -1)][1] for s in (-1, 1)]); front = np.mean([ev[(s, 1)][1] for s in (-1, 1)])
        pts = np.array([r[1] for r in raw.values() if r[0] == blk])
        u0, u1 = np.percentile(pts[:, 0], [0.7, 99.3]); v0, v1 = np.percentile(pts[:, 1], [0.7, 99.3])
        bx = BLOCK_CX[blk]
        knots[blk] = (
            ([u0, left, cx, right, u1], [bx - OUT_U, bx - AV_U, bx, bx + AV_U, bx + OUT_U]),
            ([v0, back, cz, front, v1], [-OUT_V, -AV_V, 0, AV_V, OUT_V]),
        )
        print(blk, 'u', [round(v, 1) for v in knots[blk][0][0]], 'v', [round(v, 1) for v in knots[blk][1][0]])

    imgs = {}
    stats = {}
    for f in data['firms']:
        r = raw.get(f['i'])
        if not r:
            continue
        blk, q, px, fl = r
        x, z = to_model(knots, blk, q)
        x = min(max(x, BLOCK_CX[blk] - HU + 1), BLOCK_CX[blk] + HU - 1)
        z = min(max(z, -HV + 1), HV - 1)
        f['p'] = [round(x, 1), round(z, 1)]
        if fl not in imgs:
            imgs[fl] = Image.open(PLANS.format(fl)).convert('RGB')
        col = classify(imgs[fl], *px)
        if col:
            f['c'] = col
        stats[col] = stats.get(col, 0) + 1

    json.dump(data, open(FIRMS, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for n, px in GATE_PX.items():
        x, z = to_model(knots, 'B' if n <= 6 else 'A', apply(HM, px))
        print(f'kapı {n}: x={x:.1f} z={z:.1f}')
    print('konumlu', len(raw), '/', len(data['firms']), 'renk', stats)


if __name__ == '__main__':
    main()

