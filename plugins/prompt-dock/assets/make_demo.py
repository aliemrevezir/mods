"""Draw assets/demo.gif: a scripted walk through the rail, the dock and quote-reply.

The frames are drawn on a character grid with Pillow, so they show what the mod
looks like without recording a real terminal. Run: python3 make_demo.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

COLS, ROWS = 92, 27
FONT_SIZE = 15
PAD = 14
TITLE_H = 28

BG = (30, 31, 40)
FG = (212, 214, 222)
DIM = (110, 114, 134)
BRIGHT = (245, 246, 250)
ACCENT = (217, 119, 87)
CODE = (152, 195, 121)
SEL = (68, 86, 140)
BORDER = (84, 88, 108)

FONT = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', FONT_SIZE, index=0)
BOLD = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', FONT_SIZE, index=1)
CW = round(FONT.getlength('M'))
CH = FONT_SIZE + 5
W, H = PAD * 2 + COLS * CW, TITLE_H + PAD * 2 + ROWS * CH

EXCHANGES = [
    ('Explain what a debounce function does.', [
        ('A debounce delays a call until the input has been', FG),
        ('quiet for a set time, then runs it once.', FG),
    ]),
    ('Write a TypeScript debounce helper.', [
        ('function debounce(fn: () => void, ms: number) {', CODE),
        ('  let t: ReturnType<typeof setTimeout>', CODE),
        ('  return () => { clearTimeout(t); t = setTimeout(fn, ms) }', CODE),
        ('}', CODE),
    ]),
    ('Add a leading-edge option.', [
        ('Added `leading`: the first call fires at once, later', FG),
        ('calls wait for the quiet period as before.', FG),
    ]),
    ('Write three vitest cases for it.', [
        ('Three cases: trailing call, leading call, and a burst', FG),
        ('that collapses into a single run. All pass.', FG),
    ]),
    ('Compare debounce and throttle as a short list.', [
        ('- Debounce waits for silence; throttle enforces a', FG),
        ('  minimum time between executions.', FG),
        ('- Debounce suits search boxes, throttle suits scroll.', FG),
    ]),
]
SELECTED = 'Debounce waits for silence; throttle enforces a minimum time between executions.'
TYPED = 'Show me both in one example.'
DOCK_W = 30


def transcript():
    """Lines of the whole conversation, and the line each prompt starts on."""
    lines, starts = [], []
    for prompt, answer in EXCHANGES:
        starts.append(len(lines))
        lines.append([('> ', DIM, False), (prompt, BRIGHT, False)])
        lines.append([])
        for i, (text, color) in enumerate(answer):
            lines.append([('● ' if i == 0 else '  ', ACCENT, False), (text, color, False)])
        lines.append([])
    return lines, starts


LINES, STARTS = transcript()


class Frame:
    def __init__(self):
        self.cells = {}

    def put(self, r, c, text, fg=FG, bold=False, bg=None):
        for i, ch in enumerate(text):
            if 0 <= c + i < COLS and 0 <= r < ROWS:
                self.cells[(r, c + i)] = (ch, fg, bold, bg)

    def shade(self, r, c0, c1, bg):
        for c in range(c0, c1):
            ch, fg, bold, _ = self.cells.get((r, c), (' ', FG, False, None))
            self.cells[(r, c)] = (ch, fg, bold, bg)

    def image(self, cursor=None, click=False):
        img = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, W, TITLE_H], fill=(22, 23, 30))
        for i, color in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
            x = 16 + i * 20
            d.ellipse([x, 9, x + 11, 20], fill=color)
        d.text((W // 2, TITLE_H // 2), 'claude — prompt-dock', font=FONT, fill=DIM, anchor='mm')
        for (r, c), (ch, fg, bold, bg) in self.cells.items():
            x, y = PAD + c * CW, TITLE_H + PAD + r * CH
            if bg:
                d.rectangle([x, y, x + CW, y + CH], fill=bg)
            if ch != ' ':
                d.text((x, y + 2), ch, font=BOLD if bold else FONT, fill=fg)
        if cursor:
            draw_cursor(d, *cursor, click)
        return img


def draw_cursor(d, x, y, click):
    if click:
        d.ellipse([x - 11, y - 11, x + 11, y + 11], outline=ACCENT, width=2)
    pts = [(0, 0), (0, 17), (4, 13), (7, 20), (10, 19), (7, 12), (12, 12)]
    d.polygon([(x + a, y + b) for a, b in pts], fill=(255, 255, 255), outline=(0, 0, 0))


def cell(r, c):
    """Pixel point in the middle of a cell, where the cursor tip goes."""
    return PAD + c * CW + CW // 2, TITLE_H + PAD + r * CH + CH // 2


def scene(mode='rail', top=0, current=4, hover=None, sel=False, typed='', quoted=False):
    """One screen: transcript from line `top`, then the rail or the dock, then the input."""
    f = Frame()
    f.put(0, 0, '✻ Claude Code', ACCENT, bold=True)
    f.put(0, 15, '~/projects/debounce', DIM)
    width = COLS if mode == 'rail' else COLS - DIM_GAP - DOCK_W
    input_lines = ([f'> {SELECTED}'[:COLS - 6], ''] if quoted else []) + [typed]
    input_h = len(input_lines) + 2
    rail_h = 2 if mode == 'rail' else 0
    body_h = ROWS - 2 - rail_h - input_h
    for i in range(body_h):
        n = top + i
        if n >= len(LINES):
            break
        c = 0
        for text, color, bold in LINES[n]:
            f.put(2 + i, c, text[:width - c], color, bold)
            c += len(text)
        if sel and n in SEL_LINES:
            c0, c1 = SEL_LINES[n]
            f.shade(2 + i, c0, c1, SEL)

    if mode == 'rail':
        r = ROWS - input_h - 2
        shown = hover if isinstance(hover, int) else current
        prompt = EXCHANGES[shown][0]
        f.put(r, 0, f'#{shown + 1} {prompt}', BRIGHT if isinstance(hover, int) else FG,
              bold=isinstance(hover, int))
        f.put(r, COLS - 12, '↩ Reply', BRIGHT if hover == 'reply' else DIM)
        f.put(r, COLS - 3, '[–]', BRIGHT if hover == 'dock' else DIM)
        for i in range(len(EXCHANGES)):
            here, hot = i == current, i == hover
            f.put(r + 1, i, '┃' if here else '│', BRIGHT if hot or here else DIM, bold=hot)
    else:
        x = COLS - DOCK_W
        for r in range(1, ROWS - input_h):
            f.put(r, x - 2, '│', BORDER)
        f.put(1, x, f'{len(EXCHANGES)} prompts', DIM)
        f.put(1, COLS - 4, '↩', BRIGHT if hover == 'reply' else DIM)
        f.put(1, COLS - 2, '×', DIM)
        for i, (prompt, _) in enumerate(EXCHANGES):
            here, hot = i == current, i == hover
            label = f'{"━" if here else "─"} {prompt}'
            if len(label) > DOCK_W - 2:
                label = label[:DOCK_W - 3] + '…'
            f.put(2 + i, x, label, BRIGHT if here or hot else DIM, bold=hot)

    r = ROWS - input_h
    f.put(r, 0, '╭' + '─' * (COLS - 2) + '╮', BORDER)
    for i, text in enumerate(input_lines):
        f.put(r + 1 + i, 0, '│', BORDER)
        f.put(r + 1 + i, COLS - 1, '│', BORDER)
        if i == 0:
            f.put(r + 1, 2, '>', DIM)
        f.put(r + 1 + i, 4, text, DIM if text.startswith('> ') else FG)
    last = r + len(input_lines)
    f.put(last, 4 + len(input_lines[-1]), '█', FG)
    f.put(r + input_h - 1, 0, '╰' + '─' * (COLS - 2) + '╯', BORDER)
    return f


DIM_GAP = 2
# The answer of prompt 5 holds the sentence that gets selected, over two lines.
ANSWER_5 = STARTS[4] + 2
SEL_LINES = {ANSWER_5: (4, 2 + len(EXCHANGES[4][1][0][0])),
             ANSWER_5 + 1: (4, 2 + len(EXCHANGES[4][1][1][0]))}


def build():
    frames = []  # (image, ms)

    def hold(f, ms, cursor=None, click=False):
        frames.append((f.image(cursor, click), ms))

    def move(f, a, b, steps=10, ms=30):
        for s in range(1, steps + 1):
            t = s / steps
            t = t * t * (3 - 2 * t)
            hold(f, ms, (round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t)))

    end_top = max(0, len(LINES) - 18)
    rail_r = ROWS - 3 - 2
    home = (W - 160, H - 220)

    # Rail: hover the ticks one by one, then jump to the second prompt.
    f = scene(top=end_top)
    hold(f, 1400, home)
    tick = lambda i: cell(rail_r + 1, i)
    move(f, home, tick(0), 14)
    for i in range(4):
        hold(scene(top=end_top, hover=i), 420, tick(i))
    hold(scene(top=end_top, hover=1), 500, tick(1))
    hold(scene(top=end_top, hover=1), 160, tick(1), click=True)
    f = scene(top=STARTS[1], current=1, hover=1)
    hold(f, 1300, tick(1))

    # Into the dock.
    dock_btn = cell(rail_r, COLS - 2)
    move(scene(top=STARTS[1], current=1), tick(1), dock_btn, 14)
    hold(scene(top=STARTS[1], current=1, hover='dock'), 400, dock_btn)
    hold(scene(top=STARTS[1], current=1, hover='dock'), 160, dock_btn, click=True)
    hold(scene('dock', top=STARTS[1], current=1), 1100, dock_btn)

    # Jump back to the last prompt from the dock.
    row5 = cell(6, COLS - DOCK_W + 6)
    move(scene('dock', top=STARTS[1], current=1), dock_btn, row5, 12)
    hold(scene('dock', top=STARTS[1], current=1, hover=4), 450, row5)
    hold(scene('dock', top=STARTS[1], current=1, hover=4), 160, row5, click=True)
    top = STARTS[4] - 2
    hold(scene('dock', top=top, current=4), 900, row5)

    # Type a follow-up, select a sentence, quote it with ↩.
    for n in range(1, len(TYPED) + 1, 2):
        hold(scene('dock', top=top, current=4, typed=TYPED[:n]), 45, row5)
    base = dict(top=top, current=4, typed=TYPED)
    sel_row = 2 + ANSWER_5 - top
    a, b = cell(sel_row, 4), cell(sel_row + 1, 4 + len('minimum time between executions.'))
    move(scene('dock', **base), row5, a, 12)
    for s in range(1, 11):
        x = round(a[0] + (b[0] - a[0]) * s / 10)
        y = round(a[1] + (b[1] - a[1]) * s / 10)
        f = scene('dock', **base)
        r, c = (y - TITLE_H - PAD) // CH, (x - PAD) // CW
        if r == sel_row:
            f.shade(r, 4, c, SEL)
        else:
            f.shade(sel_row, 4, SEL_LINES[ANSWER_5][1], SEL)
            f.shade(r, 4, c, SEL)
        hold(f, 40, (x, y))
    reply = cell(1, COLS - 4)
    move(scene('dock', sel=True, **base), b, reply, 14)
    hold(scene('dock', sel=True, hover='reply', **base), 450, reply)
    hold(scene('dock', sel=True, hover='reply', **base), 160, reply, click=True)
    hold(scene('dock', quoted=True, **base), 3200, reply)
    return frames


def main():
    frames = build()
    out = Path(__file__).with_name('demo.gif')
    images = [im.convert('P', palette=Image.ADAPTIVE, colors=64) for im, _ in frames]
    images[0].save(out, save_all=True, append_images=images[1:],
                   duration=[ms for _, ms in frames], loop=0, optimize=True, disposal=1)
    print(f'{out} — {len(frames)} frames, {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
