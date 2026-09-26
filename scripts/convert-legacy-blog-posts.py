"""Turn the archived Blogger HTML (git 210532a) into tutorial-shaped posts.

Reads the snapshot that used to live in public/data/blog-posts.json and writes
src/data/blogs/archive.js. Wording stays the original article. Layout becomes
sections, a table of contents, tables, and callouts.
"""
import html
import json
import re
import subprocess
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "blogs" / "archive.js"

SKIP_LINE = re.compile(
    r"^(markets|analysis|investing|macro|about|breaking|market insight|special report.*|never\s*mind.*|friday,|monday,|tuesday,|wednesday,|thursday,|saturday,|sunday,|\d+\s*min read|قراءة|تحليل)$",
    re.I,
)


def plain(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def inline_html(node):
    parts = []
    for child in node.children:
        if isinstance(child, NavigableString):
            parts.append(html.escape(str(child)))
            continue
        name = (child.name or "").lower()
        if name in ("b", "strong"):
            inner = inline_html(child)
            if inner:
                parts.append(f"<strong>{inner}</strong>")
        elif name in ("i", "em"):
            inner = inline_html(child)
            if inner:
                parts.append(f"<em>{inner}</em>")
        elif name == "br":
            parts.append(" ")
        elif name == "a":
            href = (child.get("href") or "").strip()
            inner = inline_html(child) or html.escape(plain(child))
            if href.startswith(("http://", "https://", "/")) and inner:
                parts.append(
                    f'<a href="{html.escape(href, quote=True)}" target="_blank" rel="noopener">{inner}</a>'
                )
            elif inner:
                parts.append(inner)
        elif name in ("style", "script"):
            continue
        else:
            parts.append(inline_html(child))
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def slugify_heading(text, used):
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "section"
    slug = base
    n = 2
    while slug in used:
        slug = f"{base}-{n}"
        n += 1
    used.add(slug)
    return slug


def is_chrome(text):
    if not text:
        return True
    if len(text) < 25 and SKIP_LINE.match(text.strip(" .•—-|")):
        return True
    low = text.lower()
    if "min read" in low or "دقائق" in text and len(text) < 80:
        return True
    if text in {"Markets", "Analysis", "Investing", "Macro", "About"}:
        return True
    return False


def convert_table(table):
    rows = []
    for tr in table.find_all("tr"):
        if tr.find_parent("table") not in (None, table) and tr.find_parent("table") != table:
            continue
        cells = []
        for cell in tr.find_all(["td", "th"], recursive=False):
            cells.append(plain(cell))
        if not any(cells):
            cells = [plain(td) for td in tr.find_all(["td", "th"])]
            cells = [c for c in cells if c]
        else:
            cells = [c for c in cells if c]
        if cells:
            rows.append(cells)
    if not rows:
        return None
    blob = " ".join(" ".join(r) for r in rows)
    if is_chrome(blob) or len(blob) < 12:
        return None
    if len(rows) == 1 and len(rows[0]) == 1:
        cell = rows[0][0]
        if is_chrome(cell):
            return None
        if len(cell) < 220 and (
            cell[:1] in {'"', "“", "«"} or table.find(["i", "em"]) or "—" in cell or "–" in cell[:80]
        ):
            return ("callout", html.escape(cell))
        if len(cell) < 160:
            return None
        return ("p", html.escape(cell))
    # Stat chips in one row: keep as a list, not a fake hero.
    if len(rows) == 1 and len(rows[0]) > 2 and all(len(c) < 80 for c in rows[0]):
        items = "".join(f"<li>{html.escape(c)}</li>" for c in rows[0])
        return ("ul", items)
    body = []
    for i, row in enumerate(rows):
        tag = "th" if i == 0 and len(rows) > 1 else "td"
        body.append("<tr>" + "".join(f"<{tag}>{html.escape(c)}</{tag}>" for c in row) + "</tr>")
    table_html = '<div class="table-wrap"><table><tbody>' + "".join(body) + "</tbody></table></div>"
    return ("html", table_html)


def walk(node, out):
    for child in list(getattr(node, "children", []) or []):
        if isinstance(child, NavigableString):
            continue
        name = (child.name or "").lower()
        if name in ("style", "script"):
            continue
        if name == "table":
            if child.find_parent("table"):
                continue
            block = convert_table(child)
            if block:
                out.append(block)
            continue
        if name in ("h2", "h3", "h4"):
            text = plain(child)
            if text and not is_chrome(text) and len(text) < 180:
                out.append(("h", text))
            continue
        if name in ("ul", "ol"):
            items = []
            for li in child.find_all("li", recursive=False):
                inner = inline_html(li)
                if inner and not is_chrome(plain(li)):
                    items.append(f"<li>{inner}</li>")
            if items:
                tag = "ol" if name == "ol" else "ul"
                out.append((tag, "".join(items)))
            continue
        if name == "p":
            if child.find("table") or child.find(["h2", "h3", "ul", "ol"]):
                walk(child, out)
                continue
            inner = inline_html(child)
            text = plain(child)
            if not inner or is_chrome(text):
                continue
            if len(text) < 20:
                continue
            out.append(("p", inner))
            continue
        if name in ("nav", "header", "footer", "canvas", "svg", "form"):
            continue
        if name == "img":
            src = (child.get("src") or "").strip()
            if src.startswith(("http://", "https://")):
                alt = html.escape(child.get("alt") or "", quote=True)
                out.append(("html", f'<p><img src="{html.escape(src, quote=True)}" alt="{alt}"></p>'))
            continue
        if name == "div" and not child.find(["p", "h2", "h3", "h4", "table", "ul", "ol", "div", "section", "article"]):
            inner = inline_html(child)
            text = plain(child)
            if inner and not is_chrome(text) and len(text) >= 12:
                out.append(("p", inner))
            continue
        walk(child, out)


def excerpt_from(text, locale):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 160:
        cut = text[:160]
        if " " in cut:
            cut = cut.rsplit(" ", 1)[0]
        text = cut.strip()
    if len(text) < 120:
        pad = (
            " مقال من مدونة TruePrice.Cash عن الأسواق والاستثمار."
            if locale == "ar"
            else " From the TruePrice.Cash blog on markets and investing."
        )
        text = (text + pad).strip()
        if len(text) > 160:
            text = text[:160].rsplit(" ", 1)[0].strip()
    return text


def collapse_duplicates(blocks):
    kept = []
    for block in blocks:
        text = re.sub(r"<[^>]+>", "", block[1])
        text = re.sub(r"\s+", " ", text).strip()
        low = text.lower()
        if "nevermind.blog" in low or "blogspot.com" in low:
            continue
        if kept:
            prev = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", kept[-1][1])).strip()
            if text and prev and min(len(text), len(prev)) > 50 and (text in prev or prev in text):
                if len(text) > len(prev):
                    kept[-1] = block
                continue
        kept.append(block)
    return kept


def render(blocks, locale):
    used = set()
    sections = []
    current = {"title": None, "id": None, "parts": []}

    def flush():
        if current["parts"] or current["title"]:
            sections.append({k: current[k] for k in current})

    for kind, payload in blocks:
        if kind == "h":
            if current["parts"] or current["title"]:
                flush()
            current = {"title": payload, "id": slugify_heading(payload, used), "parts": []}
            continue
        if kind == "p":
            current["parts"].append(f"<p>{payload}</p>")
        elif kind == "callout":
            label = "ملاحظة" if locale == "ar" else "Note"
            current["parts"].append(
                f'<div class="callout"><div class="callout-label">{label}</div><p>{payload}</p></div>'
            )
        elif kind in ("ul", "ol"):
            current["parts"].append(f"<{kind}>{payload}</{kind}>")
        elif kind == "html":
            current["parts"].append(payload)
    flush()

    sections = [s for s in sections if s["parts"] or s["title"]]
    if not sections:
        return "", ""

    if len(sections) == 1 and not sections[0]["title"]:
        sections[0]["title"] = "في هذا المقال" if locale == "ar" else "In this article"
        sections[0]["id"] = "overview"

    toc_label = "في هذا المقال" if locale == "ar" else "In this article"
    toc_items = []
    body = []
    for section in sections:
        if not section["id"]:
            section["id"] = slugify_heading(section["title"] or "section", used)
        title = section["title"] or ("في هذا المقال" if locale == "ar" else "In this article")
        toc_items.append(f'<li><a href="#{section["id"]}">{html.escape(title)}</a></li>')
        inner = "\n".join(section["parts"])
        body.append(
            f'<section class="section" id="{section["id"]}">\n<h2>{html.escape(title)}</h2>\n{inner}\n</section>'
        )
    toc = (
        f'<nav class="toc" aria-label="{toc_label}">\n<div class="toc-title">{toc_label}</div>\n<ol>\n'
        + "\n".join(toc_items)
        + "\n</ol>\n</nav>\n"
    )
    first_p = ""
    for section in sections:
        for part in section["parts"]:
            if part.startswith("<p>"):
                first_p = re.sub(r"<[^>]+>", "", part)
                break
        if first_p:
            break
    return toc + "\n".join(body), first_p


def main():
    raw = subprocess.check_output(["git", "show", "210532a:public/data/blog-posts.json"])
    posts = json.loads(raw)["posts"]
    archive = []
    seen = {}
    for post in posts:
        locale = post.get("lang") or ("ar" if re.search(r"[\u0600-\u06FF]", post.get("title") or "") else "en")
        soup = BeautifulSoup(post.get("content") or "", "html.parser")
        for tag in soup.find_all(["style", "script"]):
            tag.decompose()
        blocks = []
        walk(soup, blocks)
        blocks = collapse_duplicates(blocks)
        # Drop a heading that only repeats the title.
        title = re.sub(r"\s+", " ", post.get("title") or "").strip()
        blocks = [b for b in blocks if not (b[0] == "h" and b[1].lower() == title.lower())]
        content, first_p = render(blocks, locale)
        words = len(re.sub(r"<[^>]+>", " ", content).split())
        minutes = max(3, round(words / 180)) if words else 3
        reading = f"{minutes} دقائق" if locale == "ar" else f"{minutes} min"
        slug = (post.get("slug") or "post").strip()
        key = (locale, slug)
        if key in seen:
            slug = f"{slug}-{seen[key]}"
        seen[key] = seen.get(key, 1) + 1
        subtitle = first_p
        if len(subtitle) > 220:
            subtitle = subtitle[:220].rsplit(" ", 1)[0].strip()
        archive.append(
            {
                "slug": slug,
                "locale": locale,
                "title": title,
                "subtitle": subtitle,
                "excerpt": excerpt_from(first_p or title, locale),
                "content": content,
                "published": post.get("published"),
                "updated": post.get("updated") or post.get("published"),
                "readingTime": reading,
                "seriesLabel": "المدونة" if locale == "ar" else "Blog",
            }
        )
        print(f"{locale} {slug} blocks={len(blocks)} words={words}")

    payload = json.dumps(archive, ensure_ascii=False, indent=2)
    OUT.write_text(
        "/** Converted from the archived Blogger posts in git 210532a. Do not invent new articles here. */\n"
        f"export const ARCHIVE_POSTS = {payload};\n",
        encoding="utf-8",
    )
    print("wrote", OUT, "posts", len(archive))


if __name__ == "__main__":
    main()
