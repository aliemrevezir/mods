"""Draws project-hop's band frame by frame, as the terminal shows it, into a GIF. Fake projects only."""
import sys
from PIL import Image, ImageDraw, ImageFont

# Usage: python3 make_demo.py docs/demo.gif  (needs Pillow; macOS fonts)
OUT = sys.argv[1]
SCALE = 2
FS = 15 * SCALE
MENLO = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', FS)
MENLO_B = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', FS, index=1)
SYM = ImageFont.truetype('/System/Library/Fonts/Apple Symbols.ttf', FS)
EMOJI = ImageFont.truetype('/System/Library/Fonts/Apple Color Emoji.ttc', 160)
CW = round(MENLO.getlength('M'))
CH = round(FS * 1.35)
COLS, ROWS = 104, 21
PAD = 14 * SCALE

BG = (24, 24, 27)
FG = (228, 228, 231)
DIM = (120, 120, 128)
CYAN = (94, 210, 220)
GREEN = (134, 214, 134)
ORANGE = (217, 119, 87)
BORDER = (82, 82, 91)

SYM_CHARS = set('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⎇⎿')
_emoji_cache = {}


def emoji(ch):
    if ch not in _emoji_cache:
        im = Image.new('RGBA', (180, 180), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((0, 0), ch, font=EMOJI, embedded_color=True)
        im = im.crop(im.getbbox())
        side = CH - 6 * SCALE
        _emoji_cache[ch] = im.resize((round(im.width * side / im.height), side), Image.LANCZOS)
    return _emoji_cache[ch]


def seg(text, fg=FG, bold=False, inv=False, bg=None):
    return (text, fg, bold, inv, bg)


class Screen:
    def __init__(self):
        self.lines = {}

    def put(self, row, segs, col=0):
        self.lines.setdefault(row, []).append((col, segs))

    def render(self, overlay=None):
        im = Image.new('RGB', (COLS * CW + 2 * PAD, ROWS * CH + 2 * PAD), BG)
        d = ImageDraw.Draw(im)
        for row, items in self.lines.items():
            for col, segs in items:
                x = col
                for text, fg, bold, inv, bg in segs:
                    for ch in text:
                        wide = ch == '📁'
                        px, py = PAD + x * CW, PAD + row * CH
                        w = CW * (2 if wide else 1)
                        cbg = fg if inv else bg
                        if cbg:
                            d.rectangle([px, py, px + w - 1, py + CH - 1], fill=cbg)
                        color = BG if inv else fg
                        if wide:
                            e = emoji(ch)
                            im.paste(e, (px + (w - e.width) // 2, py + (CH - e.height) // 2), e)
                        elif ch != ' ':
                            font = SYM if ch in SYM_CHARS else (MENLO_B if bold else MENLO)
                            # A fallback glyph is centred in its cell, as the terminal does.
                            dx = (CW - font.getlength(ch)) / 2 if font is SYM else 0
                            d.text((px + dx, py + (CH - FS) // 2 - 2 * SCALE), ch, font=font, fill=color)
                        x += 2 if wide else 1
        if overlay:
            # The key just pressed, as a pill in the bottom-right corner.
            f = MENLO_B
            tw = f.getlength(overlay)
            x1 = im.width - PAD - 6 * SCALE
            x0 = x1 - tw - 28 * SCALE
            y1 = im.height - PAD + 4 * SCALE
            y0 = y1 - CH - 12 * SCALE
            d.rounded_rectangle([x0, y0, x1, y1], radius=10 * SCALE, fill=(63, 63, 70), outline=ORANGE, width=2 * SCALE)
            d.text((x0 + 14 * SCALE, y0 + 6 * SCALE), overlay, font=f, fill=FG)
        return im.resize((im.width // SCALE, im.height // SCALE), Image.LANCZOS)


# ---- fake data -------------------------------------------------------------

ROOT = '~/code'
PROJECTS = [
    ('finance-dashboard', 'feat/charts', True, '5m ago', 9),
    ('acme-api', 'main', True, '2h ago', 12),
    ('portfolio-site', 'main', False, '1d ago', 4),
    ('habit-tracker', 'develop', False, '2d ago', 6),
    ('recipe-box', 'main', True, '4d ago', 3),
    ('dotfiles', 'master', False, '6d ago', 2),
    ('weather-cli', 'main', False, '9d ago', 5),
    ('chat-bot', 'main', False, '12d ago', 7),
    ('pixel-editor', 'canvas-v2', True, '18d ago', 3),
    ('blog-engine', 'main', False, '1mo ago', 2),
    ('notes', None, False, '—', 0),
    ('sandbox', None, False, '—', 0),
]
SESSIONS = [
    ('5m ago', 'Split the chart components into separate files'),
    ('3h ago', 'Add a category filter to the monthly expenses table'),
    ('1d ago', 'Date format bug in CSV import'),
    ('2d ago', 'Dark mode colors fail the contrast check'),
    ('4d ago', 'Email notifications for budget alerts'),
    ('6d ago', 'Try visx instead of Recharts'),
    ('9d ago', 'Wire the Playwright tests into CI'),
    ('14d ago', 'Initial setup: Vite + React + Tailwind'),
    ('1mo ago', 'Project idea and data model'),
]
PAGE = 6
NAME_W = 32
GIT_W = 20
SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'


def button(label, primary=False):
    return seg(f'[ {label} ]', ORANGE if primary else FG)


def git_label(branch, dirty):
    if branch is None:
        return ''
    b = branch if len(branch) <= 14 else branch[:13] + '…'
    return f'⎇ {b}{" ●" if dirty else ""}'


def project_rows(page, focus, git):
    start = page * PAGE
    rows = []
    if page > 0:
        rows.append([seg('  ▲ previous page', DIM)])
    for i, (name, branch, dirty, ago, n) in enumerate(PROJECTS[start:start + PAGE]):
        label = f'📁 {name.ljust(NAME_W)}  {(git_label(branch, dirty) if git else "").ljust(GIT_W if git else 0)}{ago}'
        label += f' · {n} session{"" if n == 1 else "s"}' if n else ''
        focused = focus == start + i
        rows.append([seg(label, FG if n or focused else DIM, inv=focused)])
    if start + PAGE < len(PROJECTS):
        rows.append([seg('  ▼ next page', DIM)])
    return rows


def band_projects(page, focus=None, git=True, spin=None):
    pages = (len(PROJECTS) + PAGE - 1) // PAGE
    head = [seg(f'▸ {ROOT}', bold=True), seg(f'  {len(PROJECTS)}/{len(PROJECTS)} projects  ', DIM)]
    if spin is not None:
        head.append(seg(f'{SPIN[spin % 10]} git…  ', CYAN))
    head += [button('▲'), seg(f' {page + 1}/{pages} ', DIM), button('▼'), seg('  '), button('× close')]
    return [head, *project_rows(page, focus, git), [seg('ctrl+x tab → ↑↓ to move, Enter to open · or type a name + Enter', DIM)]]


def band_sessions(focus):
    name, branch, dirty, _, n = PROJECTS[0]
    head = [seg(f'▸ {name}', bold=True), seg(f'  {git_label(branch, dirty)}', GREEN), seg(f'  {n} sessions  ', DIM),
            button('▲'), seg(' 1/2 ', DIM), button('▼'), seg('  '), button('n new', True), seg(' '), button('b back'), seg(' '), button('× close')]
    rows = [head]
    for i, (ago, title) in enumerate(SESSIONS[:PAGE]):
        rows.append([seg(f'{i + 1:>2}  {ago.ljust(9)} {title}', inv=focus == i)])
    rows.append([seg('  ▼ next page', DIM)])
    rows.append([seg('↑↓ + Enter or a number to resume · c = latest · n = new · b = back', DIM)])
    return rows


def frame(band=None, prompt='', cursor=True, transcript=(), hint='? for shortcuts', overlay=None):
    s = Screen()
    # Welcome box.
    W = 44
    s.put(0, [seg('╭' + '─' * W + '╮', ORANGE)])
    s.put(1, [seg('│ ', ORANGE), seg('✻ ', ORANGE), seg('Welcome to Claude Code'.ljust(W - 3), bold=True), seg('│', ORANGE)])
    s.put(2, [seg('│   ', ORANGE), seg(f'cwd: {ROOT}'.ljust(W - 3), DIM), seg('│', ORANGE)])
    s.put(3, [seg('╰' + '─' * W + '╯', ORANGE)])
    for i, line in enumerate(transcript):
        s.put(5 + i, line)
    bottom = ROWS - 4
    rows = band or []
    for i, line in enumerate(rows):
        s.put(bottom - len(rows) - 1 + i, line)
    s.put(bottom, [seg('─' * COLS, BORDER)])
    s.put(bottom + 1, [seg('> ', FG), seg(prompt), seg('▌' if cursor else ' ', FG)])
    s.put(bottom + 2, [seg('─' * COLS, BORDER)])
    s.put(bottom + 3, [seg('  ' + hint, DIM)])
    return s.render(overlay)


frames = []


def add(im, ms):
    frames.append((im, ms))


# 1. Typing the command.
add(frame(), 600)
for i in range(1, len('/projects') + 1):
    add(frame(prompt='/projects'[:i]), 70)
add(frame(prompt='/projects'), 400)
# 2. Scanning the folder.
for t in range(8):
    add(frame(band=[[seg(f'{SPIN[t % 10]} scanning projects…  ', CYAN)]], overlay='Enter' if t < 5 else None), 90)
# 3. The list lands, git fills in behind it.
for t in range(8):
    add(frame(band=band_projects(0, git=False, spin=t)), 90)
add(frame(band=band_projects(0)), 1400)
# 4. Taking the keyboard and walking down the folders, across the page edge.
add(frame(band=band_projects(0, focus=0), cursor=False, overlay='ctrl+x tab'), 900)
for f in range(1, PAGE):
    add(frame(band=band_projects(0, focus=f), cursor=False, overlay='↓'), 280)
add(frame(band=band_projects(1, focus=PAGE), cursor=False, overlay='↓'), 700)
add(frame(band=band_projects(1, focus=PAGE + 1), cursor=False, overlay='↓'), 450)
# ...and back up to the first page, to the project to open.
add(frame(band=band_projects(1, focus=PAGE), cursor=False, overlay='↑'), 300)
add(frame(band=band_projects(0, focus=PAGE - 1), cursor=False, overlay='↑'), 450)
for f in range(PAGE - 2, -1, -1):
    add(frame(band=band_projects(0, focus=f), cursor=False, overlay='↑'), 140)
add(frame(band=band_projects(0, focus=0), cursor=False), 500)
# 5. Opening it: its sessions.
for t in range(6):
    head = [seg(f'▸ {ROOT}', bold=True), seg(f'  12/12 projects  ', DIM), seg(f'{SPIN[t % 10]} reading finance-dashboard sessions…', CYAN)]
    add(frame(band=[head, *band_projects(0, focus=0)[1:]], cursor=False, overlay='Enter'), 90)
add(frame(band=band_sessions(0), cursor=False), 1300)
for f in (1, 2, 1, 0):
    add(frame(band=band_sessions(f), cursor=False, overlay='↓' if f else '↑'), 330)
add(frame(band=band_sessions(0), cursor=False, overlay='Enter'), 600)
# 6. The hop: cd into the project, resume the conversation.
transcript = [
    [seg('❯ /cd ~/code/finance-dashboard', DIM)],
    [seg('  ⎿  Working directory: ~/code/finance-dashboard', DIM)],
    [seg('❯ /resume', DIM)],
    [],
    [seg('> ', DIM), seg('Split the chart components into separate files')],
    [],
    [seg('● ', FG), seg('Sure, splitting them into three files under charts/: LineChart, BarChart, Legend.')],
]
for n in range(1, len(transcript) + 1):
    add(frame(transcript=transcript[:n], hint='finance-dashboard · feat/charts'), 160)
add(frame(transcript=transcript, hint='finance-dashboard · feat/charts'), 2600)

images = [f.convert('P', palette=Image.ADAPTIVE, colors=128) for f, _ in frames]
images[0].save(OUT, save_all=True, append_images=images[1:], duration=[ms for _, ms in frames], loop=0, optimize=True, disposal=1)
print(len(frames), 'frames', images[0].size)
