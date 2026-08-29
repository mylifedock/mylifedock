import fs from "fs";
import path from "path";
import { marked } from "marked";

const docsDir = path.resolve("docs");

const files = [
  { md: "MyLifeDock_User_Handbook.md", html: "MyLifeDock_User_Handbook.html", title: "User Handbook & Operational Manual" },
  { md: "MyLifeDock_Product_Documentation.md", html: "MyLifeDock_Product_Documentation.html", title: "Product Architecture & Technical Specs" },
  { md: "MyLifeDock_Production_Release_Guide.md", html: "MyLifeDock_Production_Release_Guide.html", title: "Production & Store Release Playbook" },
  { md: "MyLifeDock_Future_Scope_Strategy.md", html: "MyLifeDock_Future_Scope_Strategy.html", title: "Future Scope, Monetization & Legal Strategy" }
];

// Configure custom marked renderer
const renderer = new marked.Renderer();
renderer.code = function({ text, lang }) {
  if (lang === 'mermaid') {
    return `<pre class="mermaid">${text}</pre>`;
  }
  return `<pre><code class="language-${lang || 'text'}">${text}</code></pre>`;
};

marked.use({ renderer });

function generateFullHtml(title, renderedBody) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - MyLifeDock</title>
    <!-- Mermaid for Flowcharts & Diagrams -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        :root {
            --bg-color: #0b0f19;
            --card-bg: #111827;
            --text-color: #e2e8f0;
            --heading-color: #38bdf8;
            --border-color: #1e293b;
            --accent-color: #22c55e;
            --code-bg: #1e293b;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.65;
            color: var(--text-color);
            background-color: var(--bg-color);
            margin: 0;
            padding: 24px 16px;
        }
        .container {
            max-width: 980px;
            margin: 0 auto;
            background: var(--card-bg);
            padding: 40px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        }
        h1, h2, h3, h4 {
            color: var(--heading-color);
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 8px;
            margin-top: 32px;
        }
        h1 { font-size: 2.2rem; }
        h2 { font-size: 1.6rem; }
        h3 { font-size: 1.3rem; }
        a { color: #38bdf8; text-decoration: none; font-weight: 500; }
        a:hover { text-decoration: underline; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
        }
        th, td {
            border: 1px solid var(--border-color);
            padding: 12px 14px;
            text-align: left;
        }
        th {
            background-color: #1e293b;
            color: #f8fafc;
        }
        tr:nth-child(even) { background-color: #0f172a; }
        tr:nth-child(odd) { background-color: #111827; }
        pre, code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            background-color: var(--code-bg);
            border-radius: 6px;
        }
        code { padding: 2px 6px; font-size: 88%; color: #7dd3fc; }
        pre { padding: 16px; overflow-x: auto; border: 1px solid var(--border-color); }
        pre code { padding: 0; background: none; color: inherit; }
        .mermaid {
            background: #ffffff;
            color: #000000;
            padding: 24px;
            border-radius: 8px;
            margin: 24px 0;
            display: flex;
            justify-content: center;
            overflow-x: auto;
            border: 1px solid #38bdf8;
        }
        blockquote {
            margin: 16px 0;
            padding: 8px 16px;
            color: #94a3b8;
            border-left: 4px solid #38bdf8;
            background: rgba(56, 189, 248, 0.05);
            border-radius: 0 8px 8px 0;
        }
        .nav-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 12px;
        }
        .nav-links a {
            margin-left: 14px;
            font-size: 14px;
            background: #1e293b;
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid #334155;
        }
        .nav-links a:hover {
            background: #334155;
            color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav-header">
            <strong>🛡️ MyLifeDock Documentation Suite</strong>
            <div class="nav-links">
                <a href="MyLifeDock_User_Handbook.html">User Handbook</a>
                <a href="MyLifeDock_Product_Documentation.html">Architecture</a>
                <a href="MyLifeDock_Production_Release_Guide.html">Release Guide</a>
                <a href="MyLifeDock_Future_Scope_Strategy.html">Future Strategy</a>
            </div>
        </div>
        <div id="content">
            ${renderedBody}
        </div>
    </div>

    <script>
        document.addEventListener("DOMContentLoaded", function() {
            if (typeof mermaid !== "undefined") {
                mermaid.initialize({ 
                    startOnLoad: true, 
                    theme: 'default',
                    securityLevel: 'loose'
                });
            }
        });
    </script>
</body>
</html>`;
}

for (const item of files) {
  const mdFilePath = path.join(docsDir, item.md);
  const htmlFilePath = path.join(docsDir, item.html);
  
  if (fs.existsSync(mdFilePath)) {
    const mdContent = fs.readFileSync(mdFilePath, "utf8");
    const renderedBody = marked.parse(mdContent);
    const fullHtml = generateFullHtml(item.title, renderedBody);
    fs.writeFileSync(htmlFilePath, fullHtml, "utf8");
    console.log(`Pre-rendered & Saved: ${item.html} (${fullHtml.length} bytes)`);
  }
}
