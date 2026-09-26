import { renderToString } from "react-dom/server"
import { App } from "@/App"
import { SITE } from "@/site"
import { routes } from "@/meta"

/** 转出给 scripts/prerender.mjs：域名只写一份（src/site.ts），路由表只写一份（src/meta.ts）。 */
export { SITE, routes }

export function render(url: string) {
  return renderToString(<App url={url} />)
}
