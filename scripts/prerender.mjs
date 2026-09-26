// Renders every route to its own HTML file, so every URL serves real markup --
// what a reader on a slow connection, a search engine and `curl` all get before
// any JavaScript runs.
import { statSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { render, routes, SITE } from "../dist-ssr/entry-server.js"

const dist = join(import.meta.dirname, "..", "dist")
const template = await readFile(join(dist, "index.html"), "utf8")
const pages = new Map()
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
// 用函数形式的替换：标题/描述里的 "$" 在字符串替换里是特殊字符（$&、$1…）。
const fill = (html, r) => html
  .replaceAll("%TITLE%", () => esc(r.title))
  .replaceAll("%DESC%", () => esc(r.desc))
  .replaceAll("%ORIGIN%", () => esc(SITE))
  .replaceAll("%CANONICAL%", () => esc(r.path === "/" ? `${SITE}/` : SITE + r.path))

for (const r of routes) {
  // 占位符先填、再插 app-html：渲染出来的正文里若出现 "%TITLE%" 这种字面量也不会被误替换。
  const html = fill(template, r).replace("<!--app-html-->", render(r.path))
  // "<route>.html", not "<route>/index.html"：Cloudflare 省略扩展名，所以规范 URL 是
  // 站内链接已经在用的无斜杠形式 —— "/install/quick-start"，而 "/install/quick-start/"
  // 会 307 到它（Workers 静态资源的 html_handling=auto-trailing-slash，见 wrangler.jsonc）。
  const file = r.path === "/" ? join(dist, "index.html") : join(dist, r.path.slice(1) + ".html")
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, html)
  pages.set(r.path, html)
}

// Anything else -- an old link, a typo -- lands on the home page with a note.
// 404 页不该有 canonical（指向任何一个真实 URL 都是错的）—— 注意要先删行、
// 再填占位符，否则占位符已经被替换掉，就删不到了。
const notFound = fill(template.replace(/^.*%CANONICAL%.*\n/gm, ""), {
  title: "页面不存在 — Spot Monitor 文档",
  desc: "这个地址没有对应的页面。",
  path: "/",
}).replace("<!--app-html-->", "")
await writeFile(join(dist, "404.html"), notFound)

console.log(`prerendered ${routes.length} routes`)

// llms.txt is the prompt from /ai as plain text. Extracted from the same MDX
// the page renders, so the two cannot drift.
const ai = await readFile(join(import.meta.dirname, "..", "src", "content", "ai.mdx"), "utf8")
const prompt = ai.match(/```text\n([\s\S]*?)\n```/)
if (!prompt) throw new Error("ai.mdx: no ```text block to publish as llms.txt")
await writeFile(join(dist, "llms.txt"), prompt[1] + "\n")

// Every in-site link must name a rendered route or a built file -- not a
// directory, which Pages answers with the 404 page -- and its fragment an id on
// the target page. A renamed route would otherwise land on the 404 page and a
// renamed heading at the top of the page, neither failing anything here.
const ids = new Map([...pages].map(([path, html]) => [path, new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]))]))
const broken = []
for (const [path, html] of pages) {
  for (const [, href] of html.matchAll(/ href="([/#][^"]*)"/g)) {
    const link = decodeURIComponent(href)
    const [target, fragment] = link.split("#")
    const page = target || path
    const found = ids.has(page) ? !fragment || ids.get(page).has(fragment) : !!statSync(join(dist, page), { throwIfNoEntry: false })?.isFile()
    if (!found) broken.push(`${path}: ${link}`)
  }
}
if (broken.length) throw new Error(`broken in-site links:\n${broken.join("\n")}`)
