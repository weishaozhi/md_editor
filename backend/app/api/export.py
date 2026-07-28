from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.database import get_db
from app.models.file import File
from app.models.user import User
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/files/{file_id}/export", tags=["文件导出"])


def _markdown_to_html(content: str, file_name: str) -> str:
    """将 Markdown 转成完整的、可独立打开的 HTML 文档。
    - 内联 CSS（参考 GitHub Markdown 风格）
    - 用轻量 Python 实现：标题 / 段落 / 列表 / 代码块 / 行内代码 / 粗体斜体 / 链接
    - 复杂场景（表格、引用嵌套、图片）做最小支持即可，超出能力保留原文
    """
    import re

    def escape_html(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    lines = content.split("\n")
    html_parts: list[str] = []
    in_code = False
    code_lang = ""
    code_buf: list[str] = []
    in_list = False
    list_type = ""  # 'ul' | 'ol'

    def flush_list():
        nonlocal in_list, list_type
        if in_list:
            html_parts.append(f"</{list_type}>")
            in_list = False
            list_type = ""

    def flush_code():
        nonlocal in_code, code_buf, code_lang
        if in_code:
            escaped = escape_html("\n".join(code_buf))
            lang_attr = f' class="language-{code_lang}"' if code_lang else ""
            html_parts.append(f"<pre><code{lang_attr}>{escaped}</code></pre>")
            in_code = False
            code_buf = []
            code_lang = ""

    i = 0
    while i < len(lines):
        line = lines[i]
        # 代码块围栏
        if line.strip().startswith("```"):
            if in_code:
                flush_code()
                i += 1
                continue
            else:
                flush_list()
                in_code = True
                code_lang = line.strip()[3:].strip()
                i += 1
                continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # 标题
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            flush_list()
            level = len(m.group(1))
            text = m.group(2)
            html_parts.append(f"<h{level}>{text}</h{level}>")
            i += 1
            continue

        # 有序列表
        m = re.match(r"^(\s*)(\d+)\.\s+(.*)$", line)
        if m:
            indent_spaces = len(m.group(1))
            if not in_list or list_type != "ol":
                flush_list()
                html_parts.append('<ol>')
                in_list = True
                list_type = "ol"
            text = m.group(3)
            pad = f' style="margin-left:{indent_spaces * 4}px"' if indent_spaces else ""
            html_parts.append(f"<li{pad}>{text}</li>")
            i += 1
            continue

        # 无序列表
        m = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        if m:
            indent_spaces = len(m.group(1))
            if not in_list or list_type != "ul":
                flush_list()
                html_parts.append('<ul>')
                in_list = True
                list_type = "ul"
            text = m.group(2)
            pad = f' style="margin-left:{indent_spaces * 4}px"' if indent_spaces else ""
            html_parts.append(f"<li{pad}>{text}</li>")
            i += 1
            continue

        # 空行: 结束列表
        if not line.strip():
            flush_list()
            i += 1
            continue

        # 段落（合并连续非空行）
        para_lines = [line]
        j = i + 1
        while j < len(lines) and lines[j].strip() and not re.match(r"^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|```)", lines[j]):
            para_lines.append(lines[j])
            j += 1
        para_text = " ".join(para_lines)
        # 行内样式: **bold** *italic* `code` [text](url)
        para_text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", para_text)
        para_text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", para_text)
        para_text = re.sub(r"`([^`]+)`", r"<code>\1</code>", para_text)
        para_text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', para_text)
        html_parts.append(f"<p>{para_text}</p>")
        i = j

    flush_list()
    flush_code()

    body = "\n".join(html_parts)

    # GitHub 风 CSS（精简版，单文件可直接打开）
    css = """
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
           line-height: 1.6; max-width: 860px; margin: 40px auto; padding: 0 20px;
           color: #1f2328; background: #ffffff; }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 8px; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 6px; }
    h3 { font-size: 1.25em; }
    p { margin: 8px 0; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 6px;
           font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 85%; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
    pre code { background: transparent; padding: 0; font-size: 85%; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul, ol { padding-left: 2em; margin: 8px 0; }
    li + li { margin-top: 4px; }
    blockquote { border-left: 3px solid #d0d7de; padding-left: 16px;
                 color: #59636e; margin: 8px 0; }
    hr { border: 0; border-top: 1px solid #d0d7de; margin: 24px 0; }
    table { border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #d0d7de; padding: 6px 13px; }
    th { background: #f6f8fa; }
    @media (prefers-color-scheme: dark) {
      body { background: #0d1117; color: #e6edf3; }
      h1, h2 { border-bottom-color: #30363d; }
      code, pre { background: #161b22; }
      th { background: #161b22; }
      th, td { border-color: #30363d; }
      blockquote { border-left-color: #30363d; color: #9198a1; }
      hr { border-top-color: #30363d; }
      a { color: #58a6ff; }
    }
    """

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>{escape_html(file_name)}</title>
<style>{css}</style>
</head>
<body>
{body}
</body>
</html>"""


@router.get("")
async def export_file(
    file_id: int,
    format: str = Query("md", regex="^(md|html)$", description="导出格式: md | html"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导出文件

    - `format=md`: 返回 Markdown 源文件原文（text/markdown）
    - `format=html`: 渲染为带 CSS 样式的完整 HTML 文档（text/html）
    """
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")

    if file.owner_id != current_user.id and file.owner_id != 1:
        raise HTTPException(status_code=403, detail="无权限访问")

    if file.is_folder:
        raise HTTPException(status_code=400, detail="文件夹不可导出")

    if format == "md":
        body = file.content
        media_type = "text/markdown; charset=utf-8"
        # md 格式: 文件名保持原样（如果原本不是 .md 也不补，避免与源文件名冲突）
        download_name = file.name
    else:
        body = _markdown_to_html(file.content, file.name)
        media_type = "text/html; charset=utf-8"
        # html 格式: 把文件名扩展名替换成 .html
        if file.name.lower().endswith(".md"):
            download_name = file.name[:-3] + ".html"
        elif "." in file.name:
            download_name = file.name.rsplit(".", 1)[0] + ".html"
        else:
            download_name = file.name + ".html"

    # 用 RFC 5987 支持中文文件名
    from urllib.parse import quote

    ascii_name = download_name.encode("ascii", "replace").decode("ascii").replace("?", "_")
    utf8_name = quote(download_name, safe="")
    content_disposition = (
        f"attachment; filename=\"{ascii_name}\"; "
        f"filename*=UTF-8''{utf8_name}"
    )

    return Response(
        content=body.encode("utf-8"),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )