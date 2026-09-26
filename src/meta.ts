import { docs } from "@/nav"

/**
 * 每个路由的标题与描述。
 *
 * 预渲染（`<title>`、`meta description`、`og:*`）与客户端跳转（`document.title`）
 * 都读这一份：以前这两处各写了一遍字符串，改一处就会出现「首屏标题和跳转后标题不一样」。
 */
export const routes = [
  {
    path: "/",
    title: "Spot Monitor — 服务器探针文档",
    desc: "用 Rust 写的服务器探针：hub 单二进制 6.3 MiB，agent 1.8 MiB，默认只监听回环。安全、极简、高效。",
  },
  ...docs.map((d) => ({ path: d.path, title: `${d.label} — Spot Monitor 文档`, desc: d.desc })),
]

const byPath = new Map(routes.map((r) => [r.path, r]))

/** 认不出的路径按首页处理，与 App 里 `!Page` 的兜底一致。 */
export function metaOf(path: string) {
  return byPath.get(path) ?? byPath.get("/")!
}
