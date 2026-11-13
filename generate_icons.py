import math
from PIL import Image, ImageDraw

def draw_tahiti_icon(size):
    img = Image.new("RGBA", (size, size), (2, 6, 23, 255))
    draw = ImageDraw.Draw(img)
    
    center = size / 2.0
    radius = size * 0.42
    
    # Outer cyan ring
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        outline=(34, 211, 238, 255),
        width=max(2, int(size * 0.03))
    )
    
    # Secondary inner ring
    inner_r1 = radius * 0.82
    draw.ellipse(
        [center - inner_r1, center - inner_r1, center + inner_r1, center + inner_r1],
        outline=(6, 182, 212, 160),
        width=max(1, int(size * 0.015))
    )
    
    # Inner reactor core
    core_r = radius * 0.52
    draw.ellipse(
        [center - core_r, center - core_r, center + core_r, center + core_r],
        fill=(15, 23, 42, 255),
        outline=(56, 189, 248, 240),
        width=max(2, int(size * 0.025))
    )
    
    # Tick marks around circumference
    num_ticks = 12
    for i in range(num_ticks):
        angle = (i * 360 / num_ticks) * math.pi / 180
        x1 = center + (radius * 0.88) * math.cos(angle)
        y1 = center + (radius * 0.88) * math.sin(angle)
        x2 = center + (radius * 0.98) * math.cos(angle)
        y2 = center + (radius * 0.98) * math.sin(angle)
        draw.line([(x1, y1), (x2, y2)], fill=(34, 211, 238, 220), width=max(2, int(size * 0.02)))

    # Central T
    w = core_r * 0.60
    h = core_r * 0.65
    top_y = center - h * 0.55
    bar_h = max(3, int(size * 0.045))
    stem_w = max(3, int(size * 0.045))
    
    draw.rectangle([center - w, top_y, center + w, top_y + bar_h], fill=(34, 211, 238, 255))
    draw.rectangle([center - stem_w/2, top_y + bar_h, center + stem_w/2, top_y + h], fill=(34, 211, 238, 255))
    
    dot_r = max(2, int(size * 0.02))
    for ang in [30, 150, 270]:
        rad = (ang * math.pi) / 180
        dx = center + (core_r * 0.75) * math.cos(rad)
        dy = center + (core_r * 0.75) * math.sin(rad)
        draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=(56, 189, 248, 255))

    return img

if __name__ == "__main__":
    draw_tahiti_icon(192).save("D:/Antigravity/TAHITI-github/icon-192.png")
    draw_tahiti_icon(512).save("D:/Antigravity/TAHITI-github/icon-512.png")
    draw_tahiti_icon(180).save("D:/Antigravity/TAHITI-github/apple-touch-icon.png")
    print("PWA Icons generated successfully!")
