function Convert-MdToHtml {
    param(
        [string]$mdPath,
        [string]$htmlPath,
        [string]$title
    )

    $mdContent = Get-Content $mdPath -Raw -Encoding UTF8
    
    # Escape backticks for javascript template literal
    $escapedMd = $mdContent.Replace('\', '\\').Replace('`', '\`').Replace('$', '\$')

    $htmlTemplate = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$title - MyLifeDock</title>
    <!-- Marked for Markdown Parsing -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <!-- Mermaid for Flowcharts & Diagrams -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #c9d1d9;
            --heading-color: #58a6ff;
            --border-color: #30363d;
            --accent-color: #238636;
            --code-bg: #1f242c;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--bg-color);
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 960px;
            margin: 0 auto;
            background: var(--card-bg);
            padding: 40px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        h1, h2, h3, h4 {
            color: var(--heading-color);
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 8px;
            margin-top: 24px;
        }
        h1 { font-size: 2.2rem; }
        h2 { font-size: 1.6rem; }
        h3 { font-size: 1.3rem; }
        a { color: #58a6ff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid var(--border-color);
            padding: 10px 14px;
            text-align: left;
        }
        th {
            background-color: #21262d;
            color: #f0f6fc;
        }
        tr:nth-child(even) { background-color: #161b22; }
        tr:nth-child(odd) { background-color: #0d1117; }
        pre, code {
            font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
            background-color: var(--code-bg);
            border-radius: 6px;
        }
        code { padding: 2px 6px; font-size: 85%; color: #79c0ff; }
        pre { padding: 16px; overflow-x: auto; border: 1px solid var(--border-color); }
        pre code { padding: 0; background: none; color: inherit; }
        .mermaid {
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            display: flex;
            justify-content: center;
        }
        blockquote {
            margin: 0;
            padding: 0 1em;
            color: #8b949e;
            border-left: 0.25em solid #30363d;
        }
        .nav-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .nav-links a {
            margin-left: 15px;
            font-weight: 500;
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
        <div id="content"></div>
    </div>

    <script>
        const markdown = `$escapedMd`;
        
        // Custom renderer for Mermaid blocks
        const renderer = new marked.Renderer();
        const defaultCodeRenderer = renderer.code.bind(renderer);
        renderer.code = function(code, language) {
            if (typeof code === 'object') {
                language = code.lang;
                code = code.text;
            }
            if (language === 'mermaid') {
                return '<div class="mermaid">' + code + '</div>';
            }
            return defaultCodeRenderer(code, language);
        };

        marked.setOptions({ renderer: renderer });
        document.getElementById('content').innerHTML = marked.parse(markdown);
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
    </script>
</body>
</html>
"@

    Set-Content -Path $htmlPath -Value $htmlTemplate -Encoding UTF8
    Write-Host "Generated: $htmlPath"
}

Convert-MdToHtml -mdPath "docs\MyLifeDock_User_Handbook.md" -htmlPath "docs\MyLifeDock_User_Handbook.html" -title "User Handbook & Operational Manual"
Convert-MdToHtml -mdPath "docs\MyLifeDock_Product_Documentation.md" -htmlPath "docs\MyLifeDock_Product_Documentation.html" -title "Product Architecture & Technical Specs"
Convert-MdToHtml -mdPath "docs\MyLifeDock_Production_Release_Guide.md" -htmlPath "docs\MyLifeDock_Production_Release_Guide.html" -title "Production & Store Release Playbook"
Convert-MdToHtml -mdPath "docs\MyLifeDock_Future_Scope_Strategy.md" -htmlPath "docs\MyLifeDock_Future_Scope_Strategy.html" -title "Future Scope, Monetization & Legal Strategy"
