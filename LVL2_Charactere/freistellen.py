"""Remove black JPEG backgrounds without changing RGB pixels. Requires Pillow/numpy."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent

def components(binary, minimum):
    # Run-length connected components: keeps large regions, including enclosed gaps.
    parents, areas, runs, previous = [], [], [], []
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for y, row in enumerate(binary):
        edges = np.flatnonzero(np.diff(np.r_[False, row, False]))
        current = []
        j = 0
        for start, stop in zip(edges[::2], edges[1::2]):
            start, stop = int(start), int(stop)
            label = len(parents)
            parents.append(label)
            areas.append(stop-start)
            while j < len(previous) and previous[j][1] <= start:
                j += 1
            k = j
            while k < len(previous) and previous[k][0] < stop:
                a, b = find(label), find(previous[k][2])
                if a != b:
                    parents[b] = a
                    areas[a] += areas[b]
                k += 1
            current.append((start, stop, label))
            runs.append((y, start, stop, label))
        previous = current
    result = np.zeros(binary.shape, dtype=np.uint8)
    for y, start, stop, label in runs:
        if areas[find(label)] >= minimum:
            result[y, start:stop] = 255
    return result

report = []
for folder in ['Geblease', 'Kaktus', 'Lupe']:
    files = sorted((ROOT/folder).glob('*.jpg'))
    sheet = Image.new('RGB', (1440, 800), 'white')
    draw = ImageDraw.Draw(sheet)
    for index, source in enumerate(files):
        with Image.open(source) as original:
            rgb = np.array(original.convert('RGB'))
        height, width = rgb.shape[:2]
        # Large near-black regions are background; small dark details remain.
        background = components(rgb.max(axis=2) <= 24, max(600, width*height//1300))
        # Preserve a three-pixel dark contour along the original sprite edges.
        background = np.array(Image.fromarray(background).filter(ImageFilter.MinFilter(7)))
        alpha = components(background == 0, 100)
        rgba = np.dstack((rgb, alpha))
        output = source.with_suffix('.png')
        Image.fromarray(rgba).save(output, optimize=True)
        with Image.open(output) as check:
            actual = np.array(check)
            assert check.mode == 'RGBA' and check.size == (width, height)
            assert np.array_equal(actual[:, :, :3], rgb)
            assert np.any(actual[:, :, 3] == 0) and np.any(actual[:, :, 3] == 255)
            assert actual[0, 0, 3] == actual[-1, -1, 3] == 0
        report.append({'file':str(output.relative_to(ROOT)), 'size':[width,height], 'transparent_percent':round(float((alpha==0).mean()*100),2), 'original_rgb_unchanged':True})
        preview = Image.fromarray(rgba)
        preview.thumbnail((340, 340))
        x,y = index%4*360,index//4*400
        for by in range(y,y+350,20):
            for bx in range(x,x+360,20):
                color = '#d0d8df' if ((bx-x)//20+(by-y)//20)%2 else '#f0f3f5'
                draw.rectangle((bx,by,bx+19,by+19),fill=color)
        sheet.paste(preview,(x+(360-preview.width)//2,y),preview)
        draw.text((x+6,y+360),output.stem.replace('_lvl2_', '_LVL2_'), fill='black')
    sheet.save(ROOT/(folder+'-transparent-vorschau.png'))
(ROOT/'transparenz-pruefung.json').write_text(json.dumps(report, indent=2),encoding='utf8')
print(f'{len(report)} PNGs erstellt; Original-RGB, Abmessungen und Alpha geprueft.')
