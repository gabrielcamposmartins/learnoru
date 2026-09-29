"""Harmoniza as cores dos sprites da Lia usando o idle.png como referência.

Uso: python tools/harmonize_sprites.py content/assets/originais content/assets
(requer numpy e Pillow; lê sempre dos originais para não acumular ajustes)

Método: transferência de cor por regiões com agrupamento conjunto.
1. Converte as 5 imagens para CIELAB.
2. Roda k-means nas cores de TODAS as imagens juntas; assim o "cabelo" de cada
   imagem cai no mesmo grupo, o "terno" no mesmo grupo, e assim por diante.
3. Para cada imagem e cada grupo, calcula média e desvio (ponderados por
   pertinência suave) e move os pixels para as estatísticas do mesmo grupo
   na referência. Os pesos suaves evitam faixas nas bordas entre regiões.
"""
import os
import sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
DST = sys.argv[2]
REF = "idle"
NAMES = ["idle", "explaining", "waiting", "cheering", "worried", "happy", "angry"]
K = 10
SIGMA = 9.0  # suavidade da pertinência (unidades Lab)

M = np.array([[0.4124564, 0.3575761, 0.1804375],
              [0.2126729, 0.7151522, 0.0721750],
              [0.0193339, 0.1191920, 0.9503041]])
MI = np.linalg.inv(M)
WHITE = np.array([0.95047, 1.0, 1.08883])
EPS, KAPPA = 216 / 24389, 24389 / 27


def to_lab(rgb):
    c = rgb / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    t = (lin @ M.T) / WHITE
    f = np.where(t > EPS, np.cbrt(t), (KAPPA * t + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def to_rgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    t = np.where(f ** 3 > EPS, f ** 3, (116 * f - 16) / KAPPA)
    lin = np.clip((t * WHITE) @ MI.T, 0, 1)
    c = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.clip(c * 255 + 0.5, 0, 255).astype(np.uint8)


def kmeans(x, k, iters=40, seed=7):
    rng = np.random.default_rng(seed)
    centers = [x[rng.integers(len(x))]]
    for _ in range(1, k):  # k-means++
        d2 = np.min(((x[:, None, :] - np.array(centers)[None]) ** 2).sum(-1), 1)
        centers.append(x[rng.choice(len(x), p=d2 / d2.sum())])
    c = np.array(centers)
    for _ in range(iters):
        lab = np.argmin(((x[:, None, :] - c[None]) ** 2).sum(-1), 1)
        c = np.array([x[lab == j].mean(0) if np.any(lab == j) else c[j] for j in range(k)])
    return c


def weights(lab, centers):
    d2 = ((lab[:, None, :] - centers[None]) ** 2).sum(-1)
    d2 -= d2.min(1, keepdims=True)
    w = np.exp(-d2 / (2 * SIGMA ** 2))
    return w / w.sum(1, keepdims=True)


imgs, alphas = {}, {}
for n in NAMES:
    im = Image.open(os.path.join(SRC, f"{n}.png"))
    alphas[n] = im.getchannel("A") if im.mode == "RGBA" else None
    imgs[n] = to_lab(np.asarray(im.convert("RGB")).astype(np.float64)).reshape(-1, 3)
    print(n, im.mode, im.size)

rng = np.random.default_rng(1)
sample = np.concatenate([imgs[n][rng.choice(len(imgs[n]), 12000, replace=False)] for n in NAMES])
centers = kmeans(sample, K)
print("centros Lab:\n", centers.round(1))

stats = {}
W = {}
for n in NAMES:
    w = weights(imgs[n], centers)
    W[n] = w
    s = w.sum(0) + 1e-6
    mu = (w.T @ imgs[n]) / s[:, None]
    var = (w.T @ (imgs[n] ** 2)) / s[:, None] - mu ** 2
    stats[n] = (mu, np.sqrt(np.maximum(var, 1e-6)), s / len(imgs[n]))

mu_r, sd_r, share_r = stats[REF]
print("participação por grupo (%):")
for n in NAMES:
    print(f"  {n:11s}", (stats[n][2] * 100).round(2))
for n in NAMES:
    im0 = Image.open(os.path.join(SRC, f"{n}.png"))
    if n == REF:
        im0.save(os.path.join(DST, f"{n}.png"), optimize=True)
        continue
    x = imgs[n]
    mu, sd, share = stats[n]
    # Grupos que quase só existem numa das imagens (ex.: o brilho amarelo do
    # cheering) não têm par confiável na referência: ficam como estão.
    g = np.clip(2 * np.minimum(share, share_r) / np.maximum(share, share_r), 0, 1)
    ratio = 1 + g[:, None] * (np.clip(sd_r / sd, 0.7, 1.4) - 1)
    target = mu + g[:, None] * (mu_r - mu)
    out = np.zeros_like(x)
    for j in range(K):
        out += W[n][:, j:j + 1] * ((x - mu[j]) * ratio[j] + target[j])
    rgb = to_rgb(out.reshape(im0.size[1], im0.size[0], 3))
    res = Image.fromarray(rgb, "RGB")
    if alphas[n] is not None:
        res.putalpha(alphas[n])
    res.save(os.path.join(DST, f"{n}.png"), optimize=True)
    shift = np.abs(mu - mu_r)
    print(f"{n}: deslocamento médio por grupo (L,a,b) = {(shift * share[:, None]).sum(0).round(2)}")
print("ok")
